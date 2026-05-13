import { Matches, ValidationOptions } from 'class-validator';
import { buildI18nValidationMessage, I18N_KEYS } from '@/i18n';

export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function ValidatorPassword(validationOptions?: ValidationOptions) {
    return Matches(PASSWORD_COMPLEXITY_REGEX, {
        message: buildI18nValidationMessage(typeof validationOptions?.message === 'string' ? validationOptions.message : undefined, I18N_KEYS.validation.password),
        ...validationOptions,
    });
}
