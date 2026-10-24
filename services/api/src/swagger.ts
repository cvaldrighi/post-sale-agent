import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Swagger UI em /docs: a "tela" de demonstração, já que não há frontend. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('post-sale-agent API')
    .setDescription(
      'API pública do assistente de pós-venda. Obtenha um token em POST /auth/token e use o ' +
        'botão "Authorize" para testar as rotas de conversa.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
}
