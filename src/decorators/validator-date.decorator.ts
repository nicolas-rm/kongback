import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsDate, IsDateString, IsOptional } from 'class-validator';
import { buildI18nValidationMessage, I18N_KEYS } from '@/i18n';

export interface ValidatorDateOptions {
    optional?: boolean;
    mode?: 'iso' | 'date';
    emptyTo?: 'undefined' | 'null';
    toDate?: boolean;
    message?: string;
}

export function ValidatorDate(options: ValidatorDateOptions = {}) {
    const { optional = false, mode = 'iso', emptyTo = 'undefined', toDate = false, message } = options;

    return applyDecorators(
        Transform(({ value }) => {
            if (value === undefined || value === null || typeof value !== 'string') return value;
            const result = value.trim();
            if (result === '') return emptyTo === 'null' ? null : undefined;
            if (!toDate) return result;
            const parsed = new Date(result);
            return Number.isNaN(parsed.getTime()) ? value : parsed;
        }),
        ...(optional ? [IsOptional()] : []),
        ...(mode === 'date'
            ? [IsDate({ message: buildI18nValidationMessage(message, I18N_KEYS.validation.date) })]
            : [IsDateString({}, { message: buildI18nValidationMessage(message, I18N_KEYS.validation.isoDate) })])
    );
}
