import { Matches } from 'class-validator';
import { ValidatorString } from '@/decorators';

export class UpdateCardholderCardNipDto {
    @ValidatorString()
    @Matches(/^\d{4}$/, { message: 'old_nip debe contener 4 digitos' })
    old_nip!: string;

    @ValidatorString()
    @Matches(/^\d{4}$/, { message: 'new_nip debe contener 4 digitos' })
    new_nip!: string;
}
