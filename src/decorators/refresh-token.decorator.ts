import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const RefreshToken = createParamDecorator((_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    return (request.cookies as Record<string, string> | undefined)?.refresh_token;
});
