import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class StructuredHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(StructuredHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const obj = exceptionResponse as { message?: string | string[]; error?: string };
      if (obj.message) message = obj.message;
      if (obj.error) code = obj.error.toUpperCase().replace(/\s+/g, '_');
    } else if (exception instanceof Error && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Unhandled error on ${request.method} ${request.url}: ${exception.stack}`);
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        code,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
