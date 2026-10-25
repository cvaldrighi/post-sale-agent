import { z } from 'zod';
import type { components } from './orders-api.types';

/**
 * Validação em tempo de execução das respostas do orders.
 *
 * Os tipos (orders-api.types.ts) são gerados de contracts/orders.yaml e garantem a compilação.
 * Estes schemas garantem o que chega pela rede. O `satisfies` amarra os dois: se o contrato
 * ganhar um campo obrigatório e o schema não, o TypeScript não compila.
 */

type Schemas = components['schemas'];

const money = z.number().int().min(0);
const currency = z.literal('BRL');
const orderStatus = z.enum(['awaiting_payment', 'paid', 'shipped', 'delayed', 'delivered', 'canceled']);

export const orderSummarySchema = z.object({
  id: z.string(),
  status: orderStatus,
  totalCents: money,
  currency,
  createdAt: z.string(),
}) satisfies z.ZodType<Schemas['OrderSummary']>;

export const orderListSchema = z.object({
  data: z.array(orderSummarySchema),
});

export const orderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customer: z.object({ name: z.string(), document: z.string() }),
  status: orderStatus,
  items: z
    .array(
      z.object({
        sku: z.string(),
        name: z.string(),
        quantity: z.number().int().min(1),
        unitPriceCents: money,
      }),
    )
    .min(1),
  totalCents: money,
  currency,
  createdAt: z.string(),
  estimatedDeliveryDate: z.string(),
  deliveredAt: z.string().nullable(),
}) satisfies z.ZodType<Schemas['Order']>;

export const paymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  method: z.enum(['pix', 'credit_card']),
  status: z.enum(['pending', 'confirmed', 'failed', 'partially_refunded', 'refunded']),
  amountCents: money,
  refundedAmountCents: money,
  currency,
  paidAt: z.string().nullable(),
  cardLast4: z.string().nullable(),
}) satisfies z.ZodType<Schemas['Payment']>;

export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type Order = z.infer<typeof orderSchema>;
export type Payment = z.infer<typeof paymentSchema>;
