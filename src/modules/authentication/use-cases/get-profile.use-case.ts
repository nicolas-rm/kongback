import { Injectable } from '@nestjs/common';
import { ProfileResponse } from '@/modules/authentication/responses';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { ListSessionsUseCase } from '@/modules/authentication/use-cases/list-sessions.use-case';

@Injectable()
export class GetProfileUseCase {
    constructor(private readonly listSessionsUseCase: ListSessionsUseCase) {}

    async execute(user: RequestUser, currentRefreshToken?: string) {
        const sessions = await this.listSessionsUseCase.execute(user.id, currentRefreshToken);
        const currentSession = sessions.find((session) => session.isCurrent) ?? null;

        return ProfileResponse.from({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            preferredLanguage: user.preferredLanguage,
            mustChangePassword: user.mustChangePassword,
            isGlobalAdmin: user.isGlobalAdmin,
            organizationIds: user.organizationIds ?? [],
            permissions: user.permissions ?? [],
            session: currentSession,
        });
    }
}
