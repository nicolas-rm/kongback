import { ValidatorBoolean, ValidatorString } from '@/decorators';

export class VerifyTwoFactorLoginDto {
    @ValidatorString()
    challengeToken!: string;

    @ValidatorString({ optional: true })
    code?: string;

    @ValidatorString({ optional: true })
    recoveryCode?: string;

    @ValidatorBoolean({ optional: true })
    trustDevice?: boolean;
}
