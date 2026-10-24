/**
 * Validação de respostas HTTP contra o contrato OpenAPI 3.1 (contracts/orders.yaml).
 *
 * Os schemas do OpenAPI 3.1 são JSON Schema (draft 2020-12), então o Ajv valida direto.
 * O matcher `expect(response).toMatchContract()` confere que:
 *  - o endpoint existe no contrato;
 *  - o status da resposta está documentado para ele;
 *  - o content-type está documentado para esse status;
 *  - o corpo obedece ao schema (inclusive sem campos extras).
 */
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Response } from 'supertest';

type Json = Record<string, any>;

const CONTRACT_FILE = join(__dirname, '..', '..', '..', 'contracts', 'orders.yaml');
const contract = load(readFileSync(CONTRACT_FILE, 'utf8')) as Json;

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(contract, 'contract');

const validators = new Map<string, ReturnType<typeof ajv.compile>>();

/** Troca "#/components/..." por "contract#/components/..." para resolver no contrato inteiro. */
function rewriteRefs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rewriteRefs);
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        key === '$ref' && typeof value === 'string' && value.startsWith('#/')
          ? `contract${value}`
          : rewriteRefs(value),
      ]),
    );
  }
  return node;
}

function resolvePointer(ref: string): Json {
  return ref
    .slice(2)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<Json>((node, key) => node[key], contract);
}

function deref(node: Json): Json {
  return typeof node?.$ref === 'string' ? deref(resolvePointer(node.$ref)) : node;
}

function findOperation(method: string, path: string): { template: string; operation: Json } | undefined {
  for (const [template, item] of Object.entries(contract.paths as Json)) {
    const pattern = new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`);
    if (pattern.test(path) && item[method]) return { template, operation: item[method] };
  }
  return undefined;
}

export function contractErrors(response: Response): string[] {
  const request = (response as unknown as { req: { method: string; path: string } }).req;
  const method = request.method.toLowerCase();
  const path = new URL(request.path, 'http://localhost').pathname;
  const label = `${request.method} ${path}`;

  const found = findOperation(method, path);
  if (!found) return [`${label} não existe no contrato`];

  const status = String(response.status);
  const responseSpec = found.operation.responses?.[status];
  if (!responseSpec) return [`${label}: status ${status} não está documentado`];

  const contentType = String(response.headers['content-type'] ?? '').split(';')[0].trim();
  const media = deref(responseSpec).content?.[contentType];
  if (!media) return [`${label}: content-type "${contentType}" não documentado para o status ${status}`];

  const key = `${method} ${found.template} ${status} ${contentType}`;
  let validate = validators.get(key);
  if (!validate) {
    validate = ajv.compile(rewriteRefs(media.schema) as object);
    validators.set(key, validate);
  }

  return validate(response.body)
    ? []
    : (validate.errors ?? []).map((e) => `${label}: ${e.instancePath || '(raiz)'} ${e.message}`);
}
