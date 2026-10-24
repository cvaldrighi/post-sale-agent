// class-transformer lê os tipos dos campos via Reflect.getMetadata. O Nest carrega isso sozinho,
// mas os testes unitários e o CLI de migrations usam este arquivo sem o Nest.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export const LLM_PROVIDERS = ['ollama', 'bedrock'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

/**
 * Variáveis de ambiente da api, com tipos e valores padrão.
 * O serviço não inicia se alguma obrigatória faltar ou for inválida.
 */
export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

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
  DATABASE_USER: string = 'app_service';

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD: string;

  /** Segredo de assinatura dos tokens. 32+ caracteres para não aceitar segredos fracos. */
  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsInt()
  @Min(60)
  JWT_EXPIRES_IN_SECONDS: number = 3600;

  @IsIn(LLM_PROVIDERS)
  LLM_PROVIDER: LlmProviderName = 'ollama';

  /** Modelo do provedor: "qwen2.5:7b" no Ollama, "us.anthropic.claude-haiku-5-5" no Bedrock. */
  @IsString()
  @IsNotEmpty()
  LLM_MODEL: string = 'qwen2.5:7b';

  @IsInt()
  @Min(1000)
  LLM_TIMEOUT_MS: number = 60000;

  @IsInt()
  @Min(1)
  LLM_MAX_TOKENS: number = 1024;

  /** Quantas mensagens recentes da conversa vão para a LLM a cada pergunta. */
  @IsInt()
  @Min(1)
  LLM_HISTORY_LIMIT: number = 20;

  @IsUrl({ require_tld: false })
  OLLAMA_BASE_URL: string = 'http://localhost:11434';

  @IsString()
  @IsNotEmpty()
  AWS_REGION: string = 'us-east-1';

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL: string = 'info';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true, // "3000" → 3000, de acordo com o tipo declarado
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
