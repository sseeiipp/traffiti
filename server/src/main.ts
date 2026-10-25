import { config } from './config.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 사진 업로드(base64 JSON)가 기본 100KB를 넘는다
  app.useBodyParser('json', { limit: '3mb' });
  app.enableCors(config.corsOrigins.length ? { origin: config.corsOrigins } : undefined);
  app.enableShutdownHooks();
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('트래비티 API').setVersion('0.1').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, doc);
  await app.listen(config.port, '0.0.0.0');
}
await bootstrap();
