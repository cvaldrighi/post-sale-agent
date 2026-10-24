// class-transformer lê os tipos dos campos via Reflect.getMetadata. O Nest carrega isso sozinho,
// mas os testes unitários e o CLI de migrations usam este arquivo sem o Nest.
import 'reflect-metadata';
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Variáveis de ambiente do serviço, com tipos e valores padrão.
 * O serviço não inicia se alguma obrigatória faltar ou for inválida.
 */
export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3002;

  @IsString()
  @IsNotEmpty()
  DATABASE_HOST: string = 'localhost';

  @IsInt()
  DATABASE_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME: string = 'post_sale';

  @IsString()
  @IsNotEmpty()
  DATABASE_USER: string = 'orders_service';

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD: string;

  /** Chave compartilhada com a `api`. Mínimo de 16 caracteres para não aceitar chaves fracas. */
  @IsString()
  @MinLength(16)
  ORDERS_API_KEY: string;

  // Variáveis de ambiente sempre chegam como texto. A conversão automática
  // transformaria "false" em true (Boolean("false") === true), então lemos o valor original.
  @Transform(({ obj }: { obj: Record<string, unknown> }) => {
    const raw = obj.ORDERS_SIMULATION_ENABLED;
    return raw === true || raw === 'true';
  })
  @IsBoolean()
  ORDERS_SIMULATION_ENABLED: boolean = false;

  @IsInt()
  @Min(0)
  ORDERS_SIMULATED_DELAY_MS: number = 5000;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true, // "3002" → 3002, de acordo com o tipo declarado
  });
  const errors = validateSync(env);

  if (errors.length > 0) {
    const details = errors
      .map((error) => `- ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${details}`);
  }

  return env;
}
