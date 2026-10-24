import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Marca uma rota como pública: não exige o token do cliente. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
