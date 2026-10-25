import { join } from 'node:path';

// Credenciais do banco vêm do .env do serviço; o resto é fixo para os testes serem previsíveis.
try {
  process.loadEnvFile(join(__dirname, '..', '.env'));
} catch {
  // Na CI, as variáveis do banco vêm do ambiente
}

process.env.JWT_SECRET = 'test-jwt-secret-0123456789-abcdefghij';
process.env.LLM_PROVIDER = 'ollama'; // substituído por um provedor falso nos testes
process.env.LLM_HISTORY_LIMIT = '20';
process.env.LOG_LEVEL = 'silent';
// O orders é substituído por um servidor falso (test/orders-stub.ts)
process.env.ORDERS_BASE_URL = 'http://127.0.0.1:3902';
process.env.ORDERS_API_KEY = 'stub-orders-key-0123456789';
process.env.ORDERS_TIMEOUT_MS = '500';
process.env.AGENT_MAX_STEPS = '5';
