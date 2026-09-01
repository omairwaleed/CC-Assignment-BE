import { Global, Module } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * Global so `@UseInterceptors(IdempotencyInterceptor)` can be dropped onto any
 * controller's create route and still get PrismaService injected, without
 * every feature module having to import this one individually.
 */
@Global()
@Module({
  providers: [IdempotencyInterceptor],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
