import { ValidatorString } from '@/decorators';

export class LogoutDto {
    @ValidatorString({ optional: true })
    refreshToken?: string;
}
