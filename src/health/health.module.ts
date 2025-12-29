import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { MetricsService } from './metrics.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    TerminusModule, // Terminus para health checks
    HttpModule,     // Para HTTP health checks se necessário
    PrismaModule,   // Para DB health check
  ],
  controllers: [HealthController],
  providers: [MetricsService],
  exports: [MetricsService], // Exportar para usar em interceptors
})
export class HealthModule {}
