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
        private readonly config: AppConfigService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([extractAccessTokenFromRequest]),
            secretOrKey: config.jwt.accessSecret,
            passReqToCallback: false,
        });
    }

    async validate(payload: JwtPayload): Promise<RequestUser> {
        if (payload.sessionId) {
            const session = await this.repository.findActiveSession(payload.sessionId);
            if (!session || session.userId !== payload.sub) return null as never;
            const touchEveryMs = this.config.session.touchIntervalSeconds * 1000;
            if (Date.now() - session.lastActivityAt.getTime() >= touchEveryMs) {
                await this.repository.touchSession(session.id, new Date(Date.now() + this.config.session.idleTimeoutMinutes * 60 * 1000));
            }
        }

        const user = await this.repository.findActiveUserForRequest(payload.sub);

        if (!user) return null as never;

        const organizationIds = new Set<string>();
        let isGlobalAdmin = false;

        for (const access of user.accesses) {
            if (access.role.code === 'admin' && !access.organizationId) isGlobalAdmin = true;
            if (access.organizationId) organizationIds.add(access.organizationId);
        }

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            preferredLanguage: user.preferredLanguage,
            mustChangePassword: user.mustChangePassword,
            isGlobalAdmin,
            organizationIds: [...organizationIds],
            sessionId: payload.sessionId ?? null,
        };
    }
}
