import { ValidatorString } from '@/decorators';

export class UpdateMyProfileDto {
    @ValidatorString({ optional: true, toLowerCase: true, emptyTo: 'null' })
    email?: string | null;

    @ValidatorString({ optional: true })
    fullName?: string;

    @ValidatorString({ optional: true, toLowerCase: true })
    preferredLanguage?: string;
}
