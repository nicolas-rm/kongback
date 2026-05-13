import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';
import { buildI18nValidationMessage, I18N_KEYS } from '@/i18n';

export interface ValidatorUUIDOptions {
    optional?: boolean;
    version?: '3' | '4' | '5' | 'all';
    emptyTo?: 'undefined' | 'null';
    message?: string;
}

export function ValidatorUUID(options: ValidatorUUIDOptions = {}) {
    const { optional = false, version = '4', emptyTo = 'undefined', message } = options;

    return applyDecorators(
        Transform(({ value }) => {
            if (value === undefined || value === null || typeof value !== 'string') return value;
            const result = value.trim();
            if (result === '') return emptyTo === 'null' ? null : undefined;
            return result;
        }),
        ...(optional ? [IsOptional()] : []),
        IsUUID(version === 'all' ? undefined : version, { message: buildI18nValidationMessage(message, I18N_KEYS.validation.uuid) })
    );
}
