import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { Observable, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

const HEADER_NAME = 'idempotency-key';

/**
 * How long a row may sit in `status = "processing"` before we treat it as an
 * abandoned reservation left behind by an attempt that died without cleaning
 * up (process killed, DB blip during the completion write, etc). It must
 * comfortably exceed the longest a legitimate request can run: the Postgres
 * statement_timeout is 15s, so 60s leaves a wide margin.
 */
const STALE_RESERVATION_MS = 60_000;

/**
 * Makes a POST endpoint safe to retry without creating duplicates (Stripe's
 * Idempotency-Key pattern). The client sends one random key per logical
 * action (not per HTTP attempt); the resource's own id is still generated
 * by the server.
 *
 * - First request with a key: runs normally, response gets cached against it.
 * - Retry with the same key + same body: the cached response is replayed,
 *   the handler never runs again.
 * - Same key reused with a different body: rejected, since that's a bug in
 *   the caller, not a retry.
 * - Same key arriving twice concurrently: the second one is rejected as
 *   "in progress" rather than racing the first into the handler.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const key = request.header(HEADER_NAME);

    if (!key) {
      throw new BadRequestException(`${HEADER_NAME} header is required.`);
    }

    const requestHash = createHash('sha256')
      .update(JSON.stringify(request.body ?? {}))
      .digest('hex');

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'This Idempotency-Key was already used with a different request body.',
        );
      }

      if (existing.status !== 'processing') {
        response.status(existing.statusCode ?? 200);

        return of(existing.responseBody);
      }

      const reservationAgeMs = Date.now() - existing.createdAt.getTime();

      if (reservationAgeMs < STALE_RESERVATION_MS) {
        throw new ConflictException(
          'A request with this Idempotency-Key is still being processed.',
        );
      }

      // The reservation is older than any request could legitimately run for,
      // so the attempt that made it died without completing or cleaning up.
      // Drop the abandoned row and fall through to reserve the key afresh.
      // Scoped to this exact row (by createdAt) so we never clobber a newer
      // reservation or a concurrent completion; if it is already gone the
      // deleteMany is a harmless no-op.
      await this.prisma.idempotencyKey.deleteMany({
        where: {
          key,
          status: 'processing',
          createdAt: existing.createdAt,
        },
      });
    }

    // Reserve the key before running the handler so a second request with the
    // same key arriving concurrently fails on this unique-constraint insert
    // instead of racing into the handler alongside the first.
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          method: request.method,
          path: request.originalUrl,
          requestHash,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A request with this Idempotency-Key is already in progress.',
        );
      }

      throw error;
    }

    return next.handle().pipe(
      mergeMap(async (data: unknown) => {
        await this.prisma.idempotencyKey.update({
          where: { key },
          data: {
            status: 'completed',
            // Every route this interceptor guards is a plain POST create with
            // no @HttpCode override, so Nest's own default status is 201.
            statusCode: 201,
            responseBody: data as Prisma.InputJsonValue,
          },
        });

        return data;
      }),
      catchError((error: unknown) => {
        // The attempt failed (validation, conflict, etc). Drop the reservation
        // so a corrected retry with the same key can actually go through
        // instead of being permanently stuck as "in progress".
        this.prisma.idempotencyKey.delete({ where: { key } }).catch(() => {});

        return throwError(() => error);
      }),
    );
  }
}
