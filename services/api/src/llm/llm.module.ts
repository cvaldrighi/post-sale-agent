import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { LlmCall } from './entities/llm-call.entity';
import { createLlmProvider } from './llm-provider.factory';
import { LLM_PROVIDER } from './llm.types';
import { LlmService } from './llm.service';

@Module({
  imports: [TypeOrmModule.forFeature([LlmCall])],
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        createLlmProvider({
          LLM_PROVIDER: config.get('LLM_PROVIDER', { infer: true }),
          LLM_MODEL: config.get('LLM_MODEL', { infer: true }),
          OLLAMA_BASE_URL: config.get('OLLAMA_BASE_URL', { infer: true }),
          AWS_REGION: config.get('AWS_REGION', { infer: true }),
        }),
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
