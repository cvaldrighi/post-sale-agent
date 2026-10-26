/**
 * Avaliação do agente com o modelo de verdade.
 *
 * Conversa com a api rodando (como um cliente faria), roda cada caso de eval/cases.json várias vezes
 * e confere o que o agente fez (app.tool_calls) e o que respondeu. O modelo não é determinístico:
 * o resultado é uma taxa de acerto, não um "passou/falhou".
 *
 *   npm run eval                 # 3 rodadas por caso
 *   EVAL_RUNS=1 npm run eval     # rápido, para conferir os casos
 *
 * Roda direto no Node (suporte nativo a TypeScript), sem compilar. Precisa da api e do Postgres no ar.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

interface EvalCase {
  id: string;
  description: string;
  customerId: string;
  message: string;
  toolsCalled?: string[];
  toolInput?: Record<string, Record<string, unknown>>;
  replyIncludesAny?: string[];
  replyExcludes?: string[];
  pendingAction?: boolean;
}

interface ToolCallRow {
  tool_name: string;
  input: Record<string, unknown>;
  outcome: string;
}

interface RunResult {
  run: number;
  passed: boolean;
  failures: string[];
  reply: string | null;
  tools: { name: string; input: unknown; outcome: string }[];
  latencyMs: number;
}

const EVAL_DIR = import.meta.dirname;
const API_URL = process.env.EVAL_API_URL ?? 'http://localhost:3000';
const RUNS = Number(process.env.EVAL_RUNS ?? 3);
const TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS ?? 120_000);

// Credenciais do banco: o mesmo .env da api (leitura de app.tool_calls e app.llm_calls)
try {
  process.loadEnvFile(join(EVAL_DIR, '..', '.env'));
} catch {
  // variáveis já no ambiente
}

/** Minúsculas e sem acentos: "Útil" e "util" contam igual. */
const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function api(path: string, init: { token?: string; body?: unknown } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

/** Confere uma rodada contra as verificações do caso. Devolve os motivos de falha (vazio = passou). */
function check(evalCase: EvalCase, reply: string, tools: ToolCallRow[], hasPendingAction: boolean): string[] {
  const failures: string[] = [];
  const succeeded = tools.filter((tool) => tool.outcome === 'success');
  const text = normalize(reply);

  for (const name of evalCase.toolsCalled ?? []) {
    if (!succeeded.some((tool) => tool.tool_name === name)) failures.push(`não chamou ${name}`);
  }
  for (const [name, expected] of Object.entries(evalCase.toolInput ?? {})) {
    const matches = succeeded.some(
      (tool) =>
        tool.tool_name === name &&
        Object.entries(expected).every(([key, value]) => tool.input?.[key] === value),
    );
    if (!matches) failures.push(`${name} sem ${JSON.stringify(expected)}`);
  }
  const includes = evalCase.replyIncludesAny ?? [];
  if (includes.length > 0 && !includes.some((term) => text.includes(normalize(term)))) {
    failures.push(`resposta sem nenhum de [${includes.join(', ')}]`);
  }
  for (const term of evalCase.replyExcludes ?? []) {
    if (text.includes(normalize(term))) failures.push(`resposta contém "${term}"`);
  }
  if (evalCase.pendingAction !== undefined && hasPendingAction !== evalCase.pendingAction) {
    failures.push(evalCase.pendingAction ? 'sem ação pendente' : 'criou ação pendente');
  }
  return failures;
}

async function runOnce(db: pg.Client, evalCase: EvalCase, run: number): Promise<RunResult> {
  const started = performance.now();
  const token = (await api('/auth/token', { body: { customerId: evalCase.customerId } })).body
    .accessToken as string;
  const conversation = await api('/conversations', { token });
  const conversationId = conversation.body.id as string;
  const response = await api(`/conversations/${conversationId}/messages`, {
    token,
    body: { content: evalCase.message },
  });
  const latencyMs = Math.round(performance.now() - started);

  const { rows: tools } = await db.query<ToolCallRow>(
    'SELECT tool_name, input, outcome FROM app.tool_calls WHERE conversation_id = $1 ORDER BY id',
    [conversationId],
  );
  const toolSummary = tools.map((tool) => ({
    name: tool.tool_name,
    input: tool.input,
    outcome: tool.outcome,
  }));

  if (response.status !== 201) {
    const reason = `HTTP ${response.status} ${String(response.body.code ?? '')}`.trim();
    return { run, passed: false, failures: [reason], reply: null, tools: toolSummary, latencyMs };
  }

  const reply = String(response.body.content);
  const failures = check(evalCase, reply, tools, response.body.pendingAction != null);
  return { run, passed: failures.length === 0, failures, reply, tools: toolSummary, latencyMs };
}

async function main() {
  const { cases } = JSON.parse(readFileSync(join(EVAL_DIR, 'cases.json'), 'utf8')) as { cases: EvalCase[] };
  const db = new pg.Client({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: process.env.DATABASE_NAME ?? 'post_sale',
    user: process.env.DATABASE_USER ?? 'app_service',
    password: process.env.DATABASE_PASSWORD,
  });
  await db.connect();

  const startedAt = new Date();
  console.log(`Avaliação: ${cases.length} casos × ${RUNS} rodadas contra ${API_URL}\n`);

  const results: { case: EvalCase; runs: RunResult[] }[] = [];
  for (const evalCase of cases) {
    const runs: RunResult[] = [];
    process.stdout.write(`${evalCase.id.padEnd(26)} `);
    for (let run = 1; run <= RUNS; run++) {
      const result = await runOnce(db, evalCase, run);
      runs.push(result);
      process.stdout.write(result.passed ? '✓' : '✗');
    }
    process.stdout.write('\n');
    results.push({ case: evalCase, runs });
  }

  // Modelo e versão do prompt das conversas desta avaliação
  const { rows: [llm] } = await db.query<{ model: string; prompt_version: string }>(
    'SELECT model, prompt_version FROM app.llm_calls WHERE created_at >= $1 ORDER BY id DESC LIMIT 1',
    [startedAt],
  );
  await db.end();

  const model = llm?.model ?? 'desconhecido';
  const promptVersion = llm?.prompt_version ?? 'desconhecido';
  const passed = results.reduce((sum, r) => sum + r.runs.filter((run) => run.passed).length, 0);
  const total = results.length * RUNS;
  const percent = (value: number, of: number) => `${Math.round((value / of) * 100)}%`.padStart(4);

  console.log(`\nModelo: ${model}   Prompt: ${promptVersion}\n`);
  console.log(`${'caso'.padEnd(26)} acertos`);
  for (const { case: evalCase, runs } of results) {
    const ok = runs.filter((run) => run.passed).length;
    console.log(`${evalCase.id.padEnd(26)} ${`${ok}/${RUNS}`.padStart(5)} ${percent(ok, RUNS)}`);
    // Motivos de falha agrupados: "não chamou search_policies (2x)"
    const reasons = new Map<string, number>();
    for (const reason of runs.flatMap((run) => run.failures)) {
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
    for (const [reason, count] of reasons) console.log(`${''.padEnd(28)}- ${reason} (${count}x)`);
  }
  console.log(`${'total'.padEnd(26)} ${`${passed}/${total}`.padStart(5)} ${percent(passed, total)}`);

  const resultsDir = join(EVAL_DIR, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const stamp = startedAt.toISOString().slice(0, 16).replace(':', '-');
  const file = join(resultsDir, `${stamp}-${promptVersion}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      { startedAt, apiUrl: API_URL, runsPerCase: RUNS, model, promptVersion, passed, total, results },
      null,
      2,
    ),
  );
  console.log(`\nResultado completo: ${file}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
