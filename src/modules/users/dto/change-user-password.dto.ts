import { ValidatorBoolean, ValidatorPassword } from '@/decorators';

export class ChangeUserPasswordDto {
    @ValidatorPassword()
    password!: string;

    @ValidatorBoolean({ optional: true })
    mustChangePassword?: boolean;
}
