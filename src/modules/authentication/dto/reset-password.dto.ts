import { ValidatorPassword, ValidatorString } from '@/decorators';

export class ResetPasswordDto {
    @ValidatorString()
    token!: string;

    @ValidatorPassword()
    password!: string;
}
