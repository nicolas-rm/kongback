import { Injectable } from '@nestjs/common';
import { ProfileResponse } from '@/modules/authentication/responses';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { GetCapabilitiesUseCase } from '@/modules/authentication/use-cases/get-capabilities.use-case';

@Injectable()
export class GetProfileUseCase {
    constructor(private readonly getCapabilitiesUseCase: GetCapabilitiesUseCase) {}

    async execute(user: RequestUser, companyId?: string) {
        const capabilities = await this.getCapabilitiesUseCase.execute(user, companyId);
        return ProfileResponse.from({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            preferredLanguage: user.preferredLanguage,
            status: user.status,
            emailVerified: user.emailVerified,
            requiresEmailVerification: user.requiresEmailVerification,
            twoFactorEnabled: user.twoFactorEnabled,
            mustChangePassword: user.mustChangePassword,
            isGlobalAdmin: user.isGlobalAdmin,
            companyIds: user.companyIds ?? [],
            sessionId: user.sessionId ?? null,
            capabilities,
        });
    }
}
