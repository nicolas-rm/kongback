import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsUUID, ValidationArguments } from 'class-validator';

export interface ValidatorUUIDOptions {
    optional?: boolean;
    version?: '3' | '4' | '5' | 'all';
    emptyTo?: 'undefined' | 'null';
    message?: string;
}

function buildMessage(message: string | undefined, fallback: (property: string) => string) {
    return (args: ValidationArguments) => message ?? fallback(args.property);
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
        IsUUID(version === 'all' ? undefined : version, { message: buildMessage(message, (property) => `${property} debe ser un UUID valido`) })
    );
}
