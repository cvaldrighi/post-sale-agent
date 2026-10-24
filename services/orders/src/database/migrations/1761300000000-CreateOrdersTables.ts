import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabelas do serviço de pedidos, no schema `orders`.
 *
 * As regras mais importantes também ficam no banco (CHECK e UNIQUE), não só no código:
 * mesmo com um bug na aplicação, o banco recusa um status inválido, um estorno duplicado
 * pela mesma chave ou um valor estornado maior que o pago.
 */
export class CreateOrdersTables1761300000000 implements MigrationInterface {
  name = 'CreateOrdersTables1761300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE orders.customers (
        id        varchar(32) PRIMARY KEY,
        name      text        NOT NULL,
        document  varchar(14) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE orders.orders (
        id                       varchar(32) PRIMARY KEY,
        customer_id              varchar(32) NOT NULL REFERENCES orders.customers (id),
        status                   varchar(20) NOT NULL
          CHECK (status IN ('awaiting_payment', 'paid', 'shipped', 'delayed', 'delivered', 'canceled')),
        items                    jsonb       NOT NULL,
        total_cents              integer     NOT NULL CHECK (total_cents >= 0),
        currency                 char(3)     NOT NULL DEFAULT 'BRL',
        created_at               timestamptz NOT NULL,
        estimated_delivery_date  date        NOT NULL,
        delivered_at             timestamptz
      )
    `);
    // Listagem de pedidos do cliente, do mais recente para o mais antigo
    await queryRunner.query(
      `CREATE INDEX orders_customer_created_idx ON orders.orders (customer_id, created_at DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE orders.payments (
        id                     varchar(32) PRIMARY KEY,
        order_id               varchar(32) NOT NULL UNIQUE REFERENCES orders.orders (id),
        method                 varchar(20) NOT NULL CHECK (method IN ('pix', 'credit_card')),
        status                 varchar(20) NOT NULL
          CHECK (status IN ('pending', 'confirmed', 'failed', 'partially_refunded', 'refunded')),
        amount_cents           integer     NOT NULL CHECK (amount_cents > 0),
        refunded_amount_cents  integer     NOT NULL DEFAULT 0,
        currency               char(3)     NOT NULL DEFAULT 'BRL',
        paid_at                timestamptz,
        card_last4             char(4),
        CONSTRAINT payments_refunded_within_amount
          CHECK (refunded_amount_cents >= 0 AND refunded_amount_cents <= amount_cents),
        CONSTRAINT payments_card_last4_only_for_card
          CHECK ((method = 'credit_card') = (card_last4 IS NOT NULL))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE orders.refunds (
        id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id         varchar(32) NOT NULL REFERENCES orders.orders (id),
        payment_id       varchar(32) NOT NULL REFERENCES orders.payments (id),
        amount_cents     integer     NOT NULL CHECK (amount_cents > 0),
        currency         char(3)     NOT NULL DEFAULT 'BRL',
        reason           text        NOT NULL,
        status           varchar(20) NOT NULL CHECK (status IN ('processing', 'completed')),
        idempotency_key  varchar(64) NOT NULL UNIQUE,
        request_hash     char(64)    NOT NULL,
        created_at       timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE orders.refunds`);
    await queryRunner.query(`DROP TABLE orders.payments`);
    await queryRunner.query(`DROP TABLE orders.orders`);
    await queryRunner.query(`DROP TABLE orders.customers`);
  }
}
