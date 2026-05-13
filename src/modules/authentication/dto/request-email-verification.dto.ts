import { ValidatorString } from '@/decorators';

export class RequestEmailVerificationDto {
    @ValidatorString({ toLowerCase: true })
    email!: string;
}
