import { Status } from '@prisma/client';
import { ValidatorBoolean, ValidatorEnum, ValidatorString } from '@/decorators';

export class UpdateUserDto {
    @ValidatorString({ optional: true })
    username?: string;

    @ValidatorString({ optional: true, toLowerCase: true })
    email?: string;

    @ValidatorString({ optional: true })
    fullName?: string;

    @ValidatorEnum(Status, { optional: true })
    status?: Status;

    @ValidatorBoolean({ optional: true })
    mustChangePassword?: boolean;

    @ValidatorString({ optional: true, toLowerCase: true })
    preferredLanguage?: string;
}
