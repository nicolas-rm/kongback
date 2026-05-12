import { Injectable } from '@nestjs/common';
import { UpdateMyProfileDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

@Injectable()
export class UpdateMyProfileUseCase {
    constructor(private readonly repository: AuthenticationRepository) {}

    execute(user: RequestUser, dto: UpdateMyProfileDto) {
        return this.repository.updateProfile(user.id, {
            email: dto.email,
            fullName: dto.fullName,
        });
    }
}
