import { Matches } from 'class-validator';
import { ValidatorString } from '@/decorators';

export class ValidateCardholderCardDto {
    @ValidatorString()
    clientId!: string;

    @ValidatorString()
    @Matches(/^(0[1-9]|1[0-2])\/?\d{2}$/, { message: 'vigencia debe tener formato MMYY o MM/YY' })
    vigencia!: string;

    @ValidatorString()
    @Matches(/^\d{4}$/, { message: 'nip debe contener 4 digitos' })
    nip!: string;
}
