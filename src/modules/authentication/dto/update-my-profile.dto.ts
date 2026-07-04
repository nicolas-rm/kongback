import { ValidatorString } from '@/decorators';

export class UpdateMyProfileDto {
    @ValidatorString({ optional: true, toLowerCase: true })
    email?: string;

    @ValidatorString({ optional: true })
    fullName?: string;

    @ValidatorString({ optional: true, toLowerCase: true })
    preferredLanguage?: string;
}
