import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@/configurations/app-config.service';
import { PrismaService } from '@/prisma/prisma.service';

type HealthStatus = 'ok' | 'error';

@Injectable()
export class HealthService {
    constructor(
        private readonly config: AppConfigService,
        private readonly prisma: PrismaService
    ) {}

    async check() {
        const database = await this.checkDatabase();
        const status: HealthStatus = database.status === 'ok' ? 'ok' : 'error';

        return {
            status,
            app: {
                name: this.config.name,
                environment: this.config.nodeEnv,
            },
            checks: {
                database,
            },
            timestamp: new Date(),
        };
    }

    private async checkDatabase(): Promise<{ status: HealthStatus }> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return { status: 'ok' };
        } catch {
            return { status: 'error' };
        }
    }
}
