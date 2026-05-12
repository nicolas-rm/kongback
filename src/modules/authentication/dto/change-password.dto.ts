import { ValidatorPassword, ValidatorString } from '@/decorators';

export class ChangePasswordDto {
    @ValidatorString()
    currentPassword!: string;

    @ValidatorPassword()
    newPassword!: string;
}
