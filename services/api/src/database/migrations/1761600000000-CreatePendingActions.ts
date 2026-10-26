import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePendingActions1761600000000 implements MigrationInterface {
  name = 'CreatePendingActions1761600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // As regras de valores ficam também no banco: nem um bug no código grava uma ação inválida
    await queryRunner.query(`
      CREATE TABLE app.pending_actions (
        id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id  uuid         NOT NULL REFERENCES app.conversations (id) ON DELETE CASCADE,
        customer_id      varchar(32)  NOT NULL,
        type             varchar(16)  NOT NULL CHECK (type IN ('refund')),
        order_id         varchar(64)  NOT NULL,
        amount_cents     integer      NOT NULL CHECK (amount_cents > 0),
        reason           varchar(500) NOT NULL CHECK (reason <> ''),
        status           varchar(16)  NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'executing', 'executed', 'failed', 'rejected')),
        result           jsonb,
        error_code       varchar(64),
        expires_at       timestamptz  NOT NULL,
        created_at       timestamptz  NOT NULL DEFAULT now(),
        decided_at       timestamptz
      )
    `);
    // "Já existe uma proposta pendente para este pedido do cliente?"
    await queryRunner.query(`
      CREATE INDEX pending_actions_customer_order_idx
        ON app.pending_actions (customer_id, order_id, status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app.pending_actions`);
  }
}
