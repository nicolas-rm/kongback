import { HealthService } from '@/modules/health/health.service';

describe('HealthService', () => {
    const config = {
        name: 'TestBackend',
        nodeEnv: 'test',
    };

    it('returns ok when database check succeeds', async () => {
        const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
        const service = new HealthService(config as never, prisma as never);

        await expect(service.check()).resolves.toMatchObject({
            status: 'ok',
            app: { name: 'TestBackend', environment: 'test' },
            checks: { database: { status: 'ok' } },
        });
    });

    it('returns error when database check fails', async () => {
        const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('db unavailable')) };
        const service = new HealthService(config as never, prisma as never);

        await expect(service.check()).resolves.toMatchObject({
            status: 'error',
            checks: { database: { status: 'error' } },
        });
    });
});
