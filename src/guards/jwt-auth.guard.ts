import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { extractAccessTokenFromRequest } from '@/modules/authentication/utils/token-extractor';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        if (isPublic) return true;
        return super.canActivate(context);
    }

    handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown, context: ExecutionContext): TUser {
        if (user) return user;

        const request = context.switchToHttp().getRequest<Request>();
        const message = err instanceof Error ? err.message : info instanceof Error ? info.message : 'No autorizado';
        throw new UnauthorizedException({
            message: 'No autorizado',
            reason: this.resolveUnauthorizedReason(message, this.getAccessToken(request)),
        });
    }

    private getAccessToken(request: Request): string | null {
        return extractAccessTokenFromRequest(request);
    }

    private resolveUnauthorizedReason(message: string, accessToken: string | null) {
        const normalized = message.toLowerCase();
        if (!accessToken || normalized.includes('no auth token')) return 'missing_access_token';
        if (normalized.includes('jwt expired')) return 'access_token_expired';
        return 'access_token_invalid';
    }
}
