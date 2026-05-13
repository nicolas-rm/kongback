import { ValidatorString } from '@/decorators';

export class VerifyTwoFactorLoginDto {
    @ValidatorString()
    challengeToken!: string;

    @ValidatorString()
    code!: string;
}
