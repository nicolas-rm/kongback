import { ValidatorString } from '@/decorators';

export class TwoFactorCodeDto {
    @ValidatorString()
    code!: string;
}
