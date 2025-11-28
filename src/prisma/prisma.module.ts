import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Disponível em todos os módulos sem precisar importar
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
