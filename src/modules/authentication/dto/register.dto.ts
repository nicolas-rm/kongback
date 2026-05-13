import { ValidatorPassword, ValidatorString } from '@/decorators';

export class RegisterDto {
    @ValidatorString()
    username!: string;

    @ValidatorString({ toLowerCase: true })
    email!: string;

    @ValidatorString()
    fullName!: string;

    @ValidatorPassword()
    password!: string;
}
