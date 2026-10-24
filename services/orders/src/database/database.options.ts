import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/** Schema do serviço. O usuário `orders_service` só tem acesso a ele. */
export const ORDERS_SCHEMA = 'orders';

export interface DatabaseSettings {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
}

/**
 * Opções do TypeORM compartilhadas pela aplicação e pelo CLI de migrations,
 * para os dois usarem exatamente a mesma configuração.
 */
export function buildDataSourceOptions(db: DatabaseSettings): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    database: db.name,
    username: db.user,
    password: db.password,
    schema: ORDERS_SCHEMA,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false, // tabelas só por migration, nunca geradas a partir das entidades
  };
}
