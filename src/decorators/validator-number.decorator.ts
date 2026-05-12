import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min, ValidationArguments } from 'class-validator';

export interface ValidatorNumberOptions {
    optional?: boolean;
    type?: 'int' | 'float';
    min?: number;
    max?: number;
    emptyTo?: 'undefined' | 'null';
    message?: string;
}

function buildMessage(message: string | undefined, fallback: (property: string) => string) {
    return (args: ValidationArguments) => message ?? fallback(args.property);
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
            ? [IsInt({ message: buildMessage(message, (property) => `${property} debe ser un numero entero valido`) })]
            : [IsNumber({}, { message: buildMessage(message, (property) => `${property} debe ser un numero valido`) })]),
        ...(min !== undefined ? [Min(min, { message: ({ property }) => `${property} debe ser mayor o igual a ${min}` })] : []),
        ...(max !== undefined ? [Max(max, { message: ({ property }) => `${property} debe ser menor o igual a ${max}` })] : [])
    );
}
