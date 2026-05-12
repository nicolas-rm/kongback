import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { AppConfigService } from '@/configurations/app-config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private readonly pool: Pool;

    constructor(config: AppConfigService) {
        const pool = new Pool({
            connectionString: config.database.url,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10_000,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
            max: 5,
        });

        super({ adapter: new PrismaPg(pool) });
        this.pool = pool;

        this.pool.on('error', (error) => {
            this.logger.error(`Prisma pool error: ${error.message}`, error.stack);
        });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
    }
}
