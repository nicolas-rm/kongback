import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { buildI18nValidationMessage, I18N_KEYS } from '@/i18n';

export interface ValidatorEnumOptions {
    optional?: boolean;
    emptyTo?: 'undefined' | 'null';
    message?: string;
    toLowerCase?: boolean;
    toUpperCase?: boolean;
}

export function ValidatorEnum<T extends object>(enumOrValues: T | readonly string[], options: ValidatorEnumOptions = {}) {
    const { optional = false, emptyTo = 'undefined', message, toLowerCase = false, toUpperCase = false } = options;
    const isArray = Array.isArray(enumOrValues);

    return applyDecorators(
        Transform(({ value }) => {
            if (value === undefined || value === null || typeof value !== 'string') return value;
            let result = value.trim();
            if (result === '') return emptyTo === 'null' ? null : undefined;
            if (toLowerCase) result = result.toLowerCase();
            if (toUpperCase) result = result.toUpperCase();
            return result;
        }),
        ...(optional ? [IsOptional()] : []),
        ...(isArray
            ? [IsIn(enumOrValues as string[], { message: buildI18nValidationMessage(message, I18N_KEYS.validation.enum) })]
            : [IsEnum(enumOrValues as T, { message: buildI18nValidationMessage(message, I18N_KEYS.validation.enum) })])
    );
}
