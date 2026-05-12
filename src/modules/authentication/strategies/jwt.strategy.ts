import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AppConfigService } from '@/configurations/app-config.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

type JwtPayload = {
    sub: string;
    username?: string;
    sessionId?: string;
};

function cookieExtractor(request: Request): string | null {
    return (request.cookies as Record<string, string> | undefined)?.access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        private readonly prisma: PrismaService,
        config: AppConfigService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor, ExtractJwt.fromAuthHeaderAsBearerToken()]),
            secretOrKey: config.jwt.accessSecret,
            passReqToCallback: false,
        });
    }

    async validate(payload: JwtPayload): Promise<RequestUser> {
        const user = await this.prisma.user.findFirst({
            where: {
                id: payload.sub,
                deletedAt: null,
                status: 'active',
            },
            select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                mustChangePassword: true,
                accesses: {
                    where: { deletedAt: null, role: { deletedAt: null } },
                    select: {
                        organizationId: true,
                        role: {
                            select: {
                                code: true,
                                permissions: {
                                    where: { permission: { deletedAt: null } },
                                    select: { permission: { select: { code: true } } },
                                },
                            },
                        },
                    },
                },
            },
        });

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
