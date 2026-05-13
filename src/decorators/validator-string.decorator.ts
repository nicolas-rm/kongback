import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { buildI18nValidationMessage, I18N_KEYS } from '@/i18n';

export interface ValidatorStringOptions {
    optional?: boolean;
    minLength?: number;
    maxLength?: number;
    toLowerCase?: boolean;
    toUpperCase?: boolean;
    collapseSpaces?: boolean;
    emptyTo?: 'undefined' | 'null';
    message?: string;
}

export function ValidatorString(options: ValidatorStringOptions = {}) {
    const { optional = false, minLength, maxLength, toLowerCase = false, toUpperCase = false, collapseSpaces = true, emptyTo = 'undefined', message } = options;

    return applyDecorators(
        Transform(({ value }) => {
            if (value === undefined || value === null || typeof value !== 'string') return value;
            let result = value.trim();
            if (collapseSpaces) result = result.replace(/\s+/g, ' ');
            if (toLowerCase) result = result.toLowerCase();
            if (toUpperCase) result = result.toUpperCase();
            if (result === '') return emptyTo === 'null' ? null : undefined;
            return result;
        }),
        ...(optional ? [IsOptional()] : [IsNotEmpty({ message: buildI18nValidationMessage(message, I18N_KEYS.validation.required) })]),
        IsString({ message: buildI18nValidationMessage(message, I18N_KEYS.validation.string) }),
        ...(minLength !== undefined ? [MinLength(minLength, { message: buildI18nValidationMessage(message, I18N_KEYS.validation.minLength, { minLength }) })] : []),
        ...(maxLength !== undefined ? [MaxLength(maxLength, { message: buildI18nValidationMessage(message, I18N_KEYS.validation.maxLength, { maxLength }) })] : [])
    );
}
