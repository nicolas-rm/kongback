import { ValidatorString } from '@/decorators';

export class VerifyEmailDto {
    @ValidatorString()
    token!: string;
}
