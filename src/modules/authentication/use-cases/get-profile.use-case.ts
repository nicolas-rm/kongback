import { Injectable } from '@nestjs/common';
import { ProfileResponse } from '@/modules/authentication/responses';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

@Injectable()
export class GetProfileUseCase {
    execute(user: RequestUser) {
        return ProfileResponse.from({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            preferredLanguage: user.preferredLanguage,
            mustChangePassword: user.mustChangePassword,
            isGlobalAdmin: user.isGlobalAdmin,
            companyIds: user.companyIds ?? [],
        });
    }
}
