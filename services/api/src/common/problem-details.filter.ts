import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { buildProblem, ProblemCode, ProblemDetails, ProblemException } from './problem';

/**
 * Converte qualquer erro em problem+json. O consumidor sempre recebe o mesmo formato,
 * com um `code` estável, e nunca detalhes internos (stack trace, SQL).
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const problem = this.toProblem(exception);

    if (problem.code === 'internal_error') {
      this.logger.error(exception); // só erros inesperados vão para o log como erro
    }

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof ProblemException) {
      return buildProblem(exception.code, exception.getStatus(), exception.detail);
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return buildProblem(codeForStatus(status), status, exception.message);
    }
    // Erros fora do Nest com status HTTP (ex.: JSON malformado no corpo)
    const status = (exception as { status?: unknown })?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return buildProblem('validation_error', status, 'Corpo da requisição inválido');
    }
    return buildProblem('internal_error', 500);
  }
}

function codeForStatus(status: number): ProblemCode {
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 503) return 'service_unavailable';
  if (status >= 400 && status < 500) return 'validation_error';
  return 'internal_error';
}
