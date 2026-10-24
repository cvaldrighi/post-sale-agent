import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dados de exemplo. Cada pedido existe para exercitar um cenário (ver design.md):
 *
 * | Pedido   | Cliente  | Status           | Pagamento          | Para testar                     |
 * |----------|----------|------------------|--------------------|---------------------------------|
 * | ord_1001 | cust_001 | delayed          | Pix, confirmed     | estorno total de Pix            |
 * | ord_1002 | cust_001 | delivered        | cartão, confirmed  | estorno parcial de cartão       |
 * | ord_1003 | cust_001 | shipped          | Pix, confirmed     | consulta                        |
 * | ord_2001 | cust_002 | canceled         | cartão, refunded   | estorno recusado (já estornado) |
 * | ord_2002 | cust_002 | awaiting_payment | Pix, pending       | estorno recusado (pendente)     |
 *
 * CPFs e cartões são fictícios.
 */
export class SeedSampleData1761300000001 implements MigrationInterface {
  name = 'SeedSampleData1761300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO orders.customers (id, name, document) VALUES
        ('cust_001', 'Ana Souza',  '123.456.789-09'),
        ('cust_002', 'Bruno Lima', '987.654.321-00')
    `);

    await queryRunner.query(`
      INSERT INTO orders.orders
        (id, customer_id, status, items, total_cents, created_at, estimated_delivery_date, delivered_at)
      VALUES
        ('ord_1001', 'cust_001', 'delayed',
         '[{"sku":"FONE-BT-01","name":"Fone de ouvido Bluetooth","quantity":1,"unitPriceCents":18990}]',
         18990, '2026-10-10T13:00:00Z', '2026-10-17', NULL),
        ('ord_1002', 'cust_001', 'delivered',
         '[{"sku":"TENIS-RUN-42","name":"Tênis de corrida","quantity":1,"unitPriceCents":34900}]',
         34900, '2026-09-20T18:30:00Z', '2026-09-27', '2026-09-25T15:10:00Z'),
        ('ord_1003', 'cust_001', 'shipped',
         '[{"sku":"CAPA-CEL-01","name":"Capinha de celular","quantity":1,"unitPriceCents":2990},
           {"sku":"PELICULA-01","name":"Película de vidro","quantity":2,"unitPriceCents":2500}]',
         7990, '2026-10-20T10:15:00Z', '2026-10-27', NULL),
        ('ord_2001', 'cust_002', 'canceled',
         '[{"sku":"MOCHILA-01","name":"Mochila","quantity":1,"unitPriceCents":12900}]',
         12900, '2026-09-01T09:00:00Z', '2026-09-08', NULL),
        ('ord_2002', 'cust_002', 'awaiting_payment',
         '[{"sku":"GARRAFA-01","name":"Garrafa térmica","quantity":1,"unitPriceCents":5990}]',
         5990, '2026-10-23T20:45:00Z', '2026-10-30', NULL)
    `);

    await queryRunner.query(`
      INSERT INTO orders.payments
        (id, order_id, method, status, amount_cents, refunded_amount_cents, paid_at, card_last4)
      VALUES
        ('pay_1001', 'ord_1001', 'pix',         'confirmed', 18990, 0,     '2026-10-10T13:02:00Z', NULL),
        ('pay_1002', 'ord_1002', 'credit_card', 'confirmed', 34900, 0,     '2026-09-20T18:31:00Z', '4242'),
        ('pay_1003', 'ord_1003', 'pix',         'confirmed', 7990,  0,     '2026-10-20T10:16:00Z', NULL),
        ('pay_2001', 'ord_2001', 'credit_card', 'refunded',  12900, 12900, '2026-09-01T09:01:00Z', '1111'),
        ('pay_2002', 'ord_2002', 'pix',         'pending',   5990,  0,     NULL,                   NULL)
    `);

    // O pedido cancelado já tem o estorno registrado, coerente com o pagamento "refunded"
    await queryRunner.query(`
      INSERT INTO orders.refunds
        (order_id, payment_id, amount_cents, reason, status, idempotency_key, request_hash, created_at)
      VALUES
        ('ord_2001', 'pay_2001', 12900, 'Pedido cancelado pelo cliente', 'completed',
         'seed-ord_2001', repeat('0', 64), '2026-09-02T11:00:00Z')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM orders.refunds`);
    await queryRunner.query(`DELETE FROM orders.payments`);
    await queryRunner.query(`DELETE FROM orders.orders`);
    await queryRunner.query(`DELETE FROM orders.customers`);
  }
}
