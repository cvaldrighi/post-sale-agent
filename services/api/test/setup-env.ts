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
