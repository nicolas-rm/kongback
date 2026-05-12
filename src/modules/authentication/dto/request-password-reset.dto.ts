import { ValidatorString } from '@/decorators';

export class RequestPasswordResetDto {
    @ValidatorString({ toLowerCase: true })
    email!: string;
}
