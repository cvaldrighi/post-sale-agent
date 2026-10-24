/**
 * DataSource usado pelo CLI do TypeORM (npm run migration:run / migration:revert).
 * A aplicação usa a mesma configuração pelo TypeOrmModule, em app.module.ts.
 */
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation';
import { buildDataSourceOptions } from './database.options';

try {
  process.loadEnvFile(); // lê o .env da pasta do serviço, quando existir
} catch {
  // Sem .env (ex.: dentro do container): usa as variáveis já definidas no ambiente
}

const env = validateEnv(process.env);

export default new DataSource(
  buildDataSourceOptions({
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    name: env.DATABASE_NAME,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
  }),
);
