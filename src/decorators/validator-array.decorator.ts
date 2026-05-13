import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsOptional } from 'class-validator';
import { buildI18nValidationMessage, I18N_KEYS } from '@/i18n';

export type ValidatorArrayOptions = {
    optional?: boolean;
    unique?: boolean;
    minSize?: number;
    maxSize?: number;
    separator?: string;
    emptyTo?: 'undefined' | 'null';
    preserveEmptyArray?: boolean;
    message?: string;
};

export function ValidatorArray(options: ValidatorArrayOptions = {}) {
    const { optional = false, unique = false, minSize, maxSize, separator = ',', emptyTo = 'undefined', preserveEmptyArray = false, message } = options;

    return applyDecorators(
        Transform(({ value }) => {
            if (value === undefined || value === null) return value;

            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed === '') return emptyTo === 'null' ? null : undefined;
                return trimmed.split(separator).map((item) => item.trim());
            }

            if (Array.isArray(value)) {
                const cleaned = value.map((item) => (typeof item === 'string' ? item.trim() : item)).filter((item) => item !== '');
                if (preserveEmptyArray && cleaned.length === 0) return [];
                return cleaned.length > 0 ? cleaned : emptyTo === 'null' ? null : undefined;
            }

            return value;
        }),
        ...(optional ? [IsOptional()] : []),
        ...(unique ? [ArrayUnique()] : []),
        IsArray({ message: buildI18nValidationMessage(message, I18N_KEYS.validation.array) }),
        ...(minSize !== undefined ? [ArrayMinSize(minSize, { message: buildI18nValidationMessage(message, I18N_KEYS.validation.minItems, { minSize }) })] : []),
        ...(maxSize !== undefined ? [ArrayMaxSize(maxSize, { message: buildI18nValidationMessage(message, I18N_KEYS.validation.maxItems, { maxSize }) })] : [])
    );
}
