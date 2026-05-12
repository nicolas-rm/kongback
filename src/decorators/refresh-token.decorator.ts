import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { extractRefreshTokenFromRequest } from '@/modules/authentication/utils/token-extractor';

export const RefreshToken = createParamDecorator((_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    return extractRefreshTokenFromRequest(request);
});
