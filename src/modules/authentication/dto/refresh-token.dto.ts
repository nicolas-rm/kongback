import { ValidatorString } from '@/decorators';

export class RefreshTokenDto {
    @ValidatorString({ optional: true })
    refreshToken?: string;
}
