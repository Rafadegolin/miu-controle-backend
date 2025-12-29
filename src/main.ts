import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔒 Helmet - Headers de segurança
  app.use(helmet({
    contentSecurityPolicy: false, // Permite Swagger funcionar
    crossOriginEmbedderPolicy: false, // Compatibilidade com recursos externos
  }));

  // CORS
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'https://miucontrole.com.br',
        'https://www.miucontrole.com.br',
      ];
      
      // Permite qualquer URL do Vercel (preview e production)
      const vercelPattern = /^https:\/\/.*\.vercel\.app$/;
      
      if (!origin || allowedOrigins.includes(origin) || vercelPattern.test(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS bloqueado: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validação automática
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ⏱️ Interceptors globais (timeout e response time)
  app.useGlobalInterceptors(
    new TimeoutInterceptor(),
    new ResponseTimeInterceptor(),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Miu Controle API') // ✅ ALTERADO
    .setDescription('API de controle financeiro pessoal do Miu Controle') // ✅ ALTERADO
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Miu Controle API rodando em http://localhost:${port}`); // ✅ ALTERADO
  console.log(`📚 Documentação em http://localhost:${port}/api/docs`);
}
bootstrap();
