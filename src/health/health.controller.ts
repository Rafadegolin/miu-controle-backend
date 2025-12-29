import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @SkipThrottle() // Health check sem rate limit
  @ApiOperation({ summary: 'Health check da API' })
  @ApiResponse({
    status: 200,
    description: 'API está funcionando',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2025-12-28T22:10:00.000Z',
        uptime: 12345.678,
        environment: 'development',
        version: '1.0.0',
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    };
  }
}
