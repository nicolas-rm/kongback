import { UserStatus } from '@prisma/client';
import { ValidatorBoolean, ValidatorEnum, ValidatorString } from '@/decorators';

export class UpdateUserDto {
    @ValidatorString({ optional: true })
    username?: string;

    @ValidatorString({ optional: true, toLowerCase: true, emptyTo: 'null' })
    email?: string | null;

    @ValidatorString({ optional: true })
    fullName?: string;

    @ValidatorEnum(UserStatus, { optional: true })
    status?: UserStatus;

    @ValidatorBoolean({ optional: true })
    mustChangePassword?: boolean;
}
