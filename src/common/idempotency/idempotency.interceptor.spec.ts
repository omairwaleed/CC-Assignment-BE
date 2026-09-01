import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { PrismaService } from '../../prisma/prisma.service';

function requestHashOf(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

/** Builds a Prisma unique-constraint violation, as thrown for a duplicate key. */
function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function makeContext(options: {
  header?: string;
  body?: unknown;
  method?: string;
}): { context: ExecutionContext; response: { status: jest.Mock } } {
  const response = { status: jest.fn() };
  const request = {
    header: jest.fn().mockReturnValue(options.header),
    body: options.body ?? {},
    method: options.method ?? 'POST',
    originalUrl: '/doctors',
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  return { context, response };
}

function makeCallHandler(observable = of({ id: 'created' })): CallHandler {
  return { handle: () => observable };
}

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let prisma: {
    idempotencyKey: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      idempotencyKey: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    interceptor = new IdempotencyInterceptor(
      prisma as unknown as PrismaService,
    );
  });

  it('rejects a request with no Idempotency-Key header', async () => {
    const { context } = makeContext({ header: undefined });

    await expect(
      interceptor.intercept(context, makeCallHandler()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it('runs the handler and caches the response on a first-time key', async () => {
    const { context, response } = makeContext({
      header: 'key-1',
      body: { a: 1 },
    });
    const handler = makeCallHandler(of({ id: 'created' }));

    prisma.idempotencyKey.findUnique.mockResolvedValue(null);
    prisma.idempotencyKey.create.mockResolvedValue({});
    prisma.idempotencyKey.update.mockResolvedValue({});

    const result$ = await interceptor.intercept(context, handler);
    const result = await firstValueFrom(result$);

    expect(result).toEqual({ id: 'created' });
    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ key: 'key-1' }),
      }),
    );
    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'key-1' },
        data: expect.objectContaining({
          status: 'completed',
          responseBody: { id: 'created' },
        }),
      }),
    );
    expect(response.status).not.toHaveBeenCalled();
  });

  it('replays the cached response instead of running the handler again', async () => {
    const { context, response } = makeContext({
      header: 'key-1',
      body: { a: 1 },
    });
    const handler = makeCallHandler();
    const requestHash = requestHashOf({ a: 1 });

    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: 'key-1',
      requestHash,
      status: 'completed',
      statusCode: 201,
      responseBody: { id: 'created' },
    });

    const result$ = await interceptor.intercept(context, handler);
    const result = await firstValueFrom(result$);

    expect(result).toEqual({ id: 'created' });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('rejects when the same key is reused with a different request body', async () => {
    const { context } = makeContext({ header: 'key-1', body: { a: 2 } });

    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: 'key-1',
      requestHash: 'some-other-hash',
      status: 'completed',
      statusCode: 201,
      responseBody: { id: 'created' },
    });

    await expect(
      interceptor.intercept(context, makeCallHandler()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a concurrent request still in progress under the same key', async () => {
    const { context } = makeContext({ header: 'key-1', body: { a: 1 } });
    const requestHash = requestHashOf({ a: 1 });

    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: 'key-1',
      requestHash,
      status: 'processing',
      statusCode: null,
      responseBody: null,
    });

    await expect(
      interceptor.intercept(context, makeCallHandler()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when two requests race the reservation insert', async () => {
    const { context } = makeContext({ header: 'key-1', body: {} });

    prisma.idempotencyKey.findUnique.mockResolvedValue(null);
    prisma.idempotencyKey.create.mockRejectedValue(uniqueConstraintError());

    await expect(
      interceptor.intercept(context, makeCallHandler()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('drops the reservation when the handler fails, so a retry can go through', async () => {
    const { context } = makeContext({ header: 'key-1', body: {} });
    const failure = new BadRequestException('bad input');
    const handler = makeCallHandler(throwError(() => failure));

    prisma.idempotencyKey.findUnique.mockResolvedValue(null);
    prisma.idempotencyKey.create.mockResolvedValue({});
    prisma.idempotencyKey.delete.mockResolvedValue({});

    const result$ = await interceptor.intercept(context, handler);

    await expect(firstValueFrom(result$)).rejects.toBe(failure);
    expect(prisma.idempotencyKey.delete).toHaveBeenCalledWith({
      where: { key: 'key-1' },
    });
  });
});
