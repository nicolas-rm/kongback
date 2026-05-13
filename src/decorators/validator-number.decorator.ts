import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { buildI18nValidationMessage, I18N_KEYS } from '@/i18n';

export interface ValidatorNumberOptions {
    optional?: boolean;
    type?: 'int' | 'float';
    min?: number;
    max?: number;
    emptyTo?: 'undefined' | 'null';
    message?: string;
}

export function ValidatorNumber(options: ValidatorNumberOptions = {}) {
    const { optional = false, type = 'int', min, max, emptyTo = 'undefined', message } = options;

    return applyDecorators(
        Transform(({ value }) => {
            if (value === undefined || value === null) return value;
            if (typeof value !== 'string') return value;
            const result = value.trim();
            if (result === '') return emptyTo === 'null' ? null : undefined;
            if (type === 'int') return /^-?\d+$/.test(result) ? Number.parseInt(result, 10) : value;
            const parsed = Number(result);
            return Number.isNaN(parsed) ? value : parsed;
        }),
        ...(optional ? [IsOptional()] : []),
        ...(type === 'int'
            ? [IsInt({ message: buildI18nValidationMessage(message, I18N_KEYS.validation.integer) })]
            : [IsNumber({}, { message: buildI18nValidationMessage(message, I18N_KEYS.validation.number) })]),
        ...(min !== undefined ? [Min(min, { message: buildI18nValidationMessage(message, I18N_KEYS.validation.minValue, { min }) })] : []),
        ...(max !== undefined ? [Max(max, { message: buildI18nValidationMessage(message, I18N_KEYS.validation.maxValue, { max }) })] : [])
    );
}
