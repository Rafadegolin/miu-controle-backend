/**
 * Exporta o documento OpenAPI (Swagger) da API para docs/handoff/openapi.json.
 *
 * Replica a configuração de prefixo/versionamento do main.ts para que os paths
 * saiam como /api/v1/... — igual à API em runtime.
 *
 * Uso: npm run openapi:export
 *
 * Observação: sobe o AppModule para extrair o documento, então conecta no
 * banco/Redis no boot (requer as envs). NÃO grava dados.
 */
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';

async function run() {
  const app = await NestFactory.create(AppModule, { logger: false });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  const config = new DocumentBuilder()
    .setTitle('Miu Controle API')
    .setDescription('API de controle financeiro pessoal do Miu Controle')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outDir = join(__dirname, '..', 'docs', 'handoff');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));

  const pathCount = Object.keys(document.paths || {}).length;
  console.log(`✅ OpenAPI exportado em ${outPath} (${pathCount} paths)`);

  await app.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Falha ao exportar OpenAPI:', err);
  process.exit(1);
});
