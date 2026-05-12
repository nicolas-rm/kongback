import { Injectable } from '@nestjs/common';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { ListSessionsUseCase } from '@/modules/authentication/use-cases/list-sessions.use-case';

@Injectable()
export class GetProfileUseCase {
    constructor(private readonly listSessionsUseCase: ListSessionsUseCase) {}

    async execute(user: RequestUser, currentRefreshToken?: string) {
        const sessions = await this.listSessionsUseCase.execute(user.id, currentRefreshToken);
        const currentSession = sessions.find((session) => session.isCurrent) ?? null;

        return {
            ...user,
            session: currentSession,
        };
    }
}
