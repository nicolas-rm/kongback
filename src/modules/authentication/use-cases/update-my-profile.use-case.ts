import { Injectable } from '@nestjs/common';
import { UpdateMyProfileDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { UpdateProfileResponse } from '@/modules/authentication/responses';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

@Injectable()
export class UpdateMyProfileUseCase {
    constructor(private readonly repository: AuthenticationRepository) {}

    async execute(user: RequestUser, dto: UpdateMyProfileDto) {
        const profile = await this.repository.updateProfile(user.id, {
            email: dto.email,
            fullName: dto.fullName,
        });
        return UpdateProfileResponse.from(profile);
    }
}
