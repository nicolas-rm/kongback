import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

type HealthStatus = 'ok' | 'error';

@Injectable()
export class HealthService {
    constructor(private readonly prisma: PrismaService) {}

    async check() {
        const database = await this.checkDatabase();
        const status: HealthStatus = database.status === 'ok' ? 'ok' : 'error';

        return {
            status,
            checks: {
                database,
            },
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
