import { UserStatus } from '@prisma/client';
import { ValidatorEnum, ValidatorPassword, ValidatorString } from '@/decorators';

export class CreateUserDto {
    @ValidatorString()
    username!: string;

    @ValidatorString({ optional: true, toLowerCase: true })
    email?: string;

    @ValidatorString()
    fullName!: string;

    @ValidatorPassword()
    password!: string;

    @ValidatorEnum(UserStatus, { optional: true })
    status?: UserStatus;

    @ValidatorString({ optional: true, toLowerCase: true })
    preferredLanguage?: string;
}
