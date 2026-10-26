import { z } from 'zod';
import type { components } from './retrieval-api.types';

/**
 * Validação em tempo de execução das respostas do retrieval.
 *
 * Os tipos (retrieval-api.types.ts) são gerados de contracts/retrieval.json, que o próprio retrieval
 * exporta do código (code-first). O `satisfies` amarra os dois, como no cliente do orders.
 */

type Schemas = components['schemas'];

export const searchResultSchema = z.object({
  chunkId: z.number().int(),
  source: z.string(),
  documentTitle: z.string(),
  section: z.string(),
  text: z.string(),
  score: z.number(),
}) satisfies z.ZodType<Schemas['SearchResult']>;

export const searchOutSchema = z.object({
  results: z.array(searchResultSchema),
}) satisfies z.ZodType<Schemas['SearchOut']>;

export type SearchIn = Schemas['SearchIn'];
export type SearchResult = z.infer<typeof searchResultSchema>;
