import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '@/configurations/app-config.service';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { extractAccessTokenFromRequest } from '@/modules/authentication/utils/token-extractor';

type JwtPayload = {
    sub: string;
    username?: string;
    sessionId?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        private readonly repository: AuthenticationRepository,
        config: AppConfigService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([extractAccessTokenFromRequest]),
            secretOrKey: config.jwt.accessSecret,
            passReqToCallback: false,
        });
    }

    async validate(payload: JwtPayload): Promise<RequestUser> {
        const user = await this.repository.findActiveUserForRequest(payload.sub);

        if (!user) return null as never;

        const permissions = new Set<string>();
        const organizationIds = new Set<string>();
        let isGlobalAdmin = false;

        for (const access of user.accesses) {
            if (access.role.code === 'admin' && !access.organizationId) isGlobalAdmin = true;
            if (access.organizationId) organizationIds.add(access.organizationId);
            for (const rolePermission of access.role.permissions) {
                permissions.add(rolePermission.permission.code);
            }
        }

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            mustChangePassword: user.mustChangePassword,
            isGlobalAdmin,
            organizationIds: [...organizationIds],
            permissions: [...permissions],
            sessionId: payload.sessionId ?? null,
        };
    }
}
