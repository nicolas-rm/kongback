import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';

export const SessionContextData = createParamDecorator((_data: unknown, context: ExecutionContext): SessionContext => {
    const request = context.switchToHttp().getRequest<Request>();
    const forwardedFor = request.get('x-forwarded-for')?.split(',')[0]?.trim();

    return {
        ipAddress: forwardedFor || request.ip || null,
        userAgent: request.get('user-agent') ?? null,
        deviceName: request.get('x-device-name') ?? null,
    };
});
