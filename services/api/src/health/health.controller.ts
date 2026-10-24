import { Controller, Get, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProblemException } from '../common/problem';
import { Public } from '../common/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok' };
    } catch {
      throw new ProblemException(
        'service_unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        'Banco de dados indisponível',
      );
    }
  }
}
