import { ValidatorString } from '@/decorators';

export class LoginDto {
    @ValidatorString()
    username!: string;

    @ValidatorString()
    password!: string;

    @ValidatorString({ optional: true, maxLength: 256 })
    trustedDeviceToken?: string;
}
