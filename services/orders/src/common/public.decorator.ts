import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Marca uma rota como pública: sem chave de API e sem simulação de falhas. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
