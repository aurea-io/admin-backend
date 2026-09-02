import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get('live')
  live() {
    return {
      status: 'ok',
      scope: 'platform',
      check: 'liveness',
      commit: process.env.RENDER_GIT_COMMIT ?? 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}
