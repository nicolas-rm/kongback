import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, ValidationArguments } from 'class-validator';

export interface ValidatorBooleanOptions {
    optional?: boolean;
    emptyTo?: 'undefined' | 'null';
    message?: string;
}

function buildMessage(message: string | undefined, fallback: (property: string) => string) {
    return (args: ValidationArguments) => message ?? fallback(args.property);
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
        IsBoolean({ message: buildMessage(message, (property) => `${property} debe ser true o false`) })
    );
}
