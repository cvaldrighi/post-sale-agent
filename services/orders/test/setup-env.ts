import { join } from 'node:path';

// Credenciais do banco vêm do .env do serviço; o resto é fixo para os testes serem previsíveis.
try {
  process.loadEnvFile(join(__dirname, '..', '.env'));
} catch {
  // Na CI, as variáveis do banco vêm do ambiente
}

process.env.ORDERS_API_KEY = 'test-api-key-0123456789';
process.env.ORDERS_SIMULATION_ENABLED = 'true';
process.env.ORDERS_SIMULATED_DELAY_MS = '300';
process.env.LOG_LEVEL = 'silent';
