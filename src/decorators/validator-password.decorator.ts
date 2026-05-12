import { Matches, ValidationOptions } from 'class-validator';

export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function ValidatorPassword(validationOptions?: ValidationOptions) {
    return Matches(PASSWORD_COMPLEXITY_REGEX, {
        message: 'La contrasena debe incluir al menos 8 caracteres, una mayuscula, una minuscula y un numero',
        ...validationOptions,
    });
}
