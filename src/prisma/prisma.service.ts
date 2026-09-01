import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL not defined.');
    }

    super({
      adapter: new PrismaPg({
        connectionString,
        max: 10,
        idleTimeoutMillis: 300_000,
        connectionTimeoutMillis: 10_000,
        statement_timeout: 15_000,
        query_timeout: 15_000,
        ssl: { rejectUnauthorized: false },
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
