import { ValidatorString } from '@/decorators';

export class LoginDto {
    @ValidatorString()
    username!: string;

    @ValidatorString()
    password!: string;
}
