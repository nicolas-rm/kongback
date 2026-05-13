import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { buildI18nValidationMessage, I18N_KEYS } from '@/i18n';

export interface ValidatorBooleanOptions {
    optional?: boolean;
    emptyTo?: 'undefined' | 'null';
    message?: string;
}

export function ValidatorBoolean(options: ValidatorBooleanOptions = {}) {
    const { optional = false, emptyTo = 'undefined', message } = options;

    return applyDecorators(
        Transform(({ value }) => {
            if (value === undefined || value === null) return value;
            if (typeof value !== 'string') return value;
            const result = value.trim().toLowerCase();
            if (result === '') return emptyTo === 'null' ? null : undefined;
            if (result === 'true' || result === '1') return true;
            if (result === 'false' || result === '0') return false;
            return value;
        }),
        ...(optional ? [IsOptional()] : []),
        IsBoolean({ message: buildI18nValidationMessage(message, I18N_KEYS.validation.boolean) })
    );
}
