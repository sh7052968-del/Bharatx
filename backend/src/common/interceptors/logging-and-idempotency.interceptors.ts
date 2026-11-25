import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { from, Observable, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedPrincipal, IDEMPOTENT_KEY } from '../decorators/auth.decorators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const started = Date.now();
    return next.handle().pipe(
      mergeMap((data) => {
        const res = context.switchToHttp().getResponse<Response>();
        const elapsed = Date.now() - started;
        this.logger.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsed}ms)`);
        return of(data);
      }),
    );
  }
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isIdempotent) return next.handle();

    const req = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedPrincipal }
    >();
    const rawKey = req.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!idempotencyKey || !idempotencyKey.trim()) {
      return next.handle();
    }
    if (idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency-Key header exceeds 128 characters');
    }

    const userId = req.user?.userId || 'anonymous';
    const method = req.method;
    const path = req.route?.path || req.path;

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        userId_idempotencyKey_method_path: {
          userId,
          idempotencyKey: idempotencyKey.trim(),
          method,
          path,
        },
      },
    });

    if (existing && existing.expiresAt > new Date()) {
      const res = context.switchToHttp().getResponse<Response>();
      res.status(existing.statusCode);
      return of(existing.responseJson);
    }

    return next.handle().pipe(
      mergeMap((body) =>
        from(
          this.prisma.idempotencyRecord
            .upsert({
              where: {
                userId_idempotencyKey_method_path: {
                  userId,
                  idempotencyKey: idempotencyKey.trim(),
                  method,
                  path,
                },
              },
              update: {
                statusCode: 200,
                responseJson: (body ?? {}) as object,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
              create: {
                userId,
                idempotencyKey: idempotencyKey.trim(),
                method,
                path,
                statusCode: context.switchToHttp().getResponse<Response>().statusCode || 200,
                responseJson: (body ?? {}) as object,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
            })
            .then(() => body),
        ),
      ),
    );
  }
}
