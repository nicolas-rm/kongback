import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidationArguments } from 'class-validator';

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

function buildMessage(message: string | undefined, fallback: (property: string) => string) {
    return (args: ValidationArguments) => message ?? fallback(args.property);
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
        ...(optional ? [IsOptional()] : [IsNotEmpty({ message: buildMessage(message, (property) => `${property} es obligatorio`) })]),
        IsString({ message: buildMessage(message, (property) => `${property} debe ser un texto valido`) }),
        ...(minLength !== undefined ? [MinLength(minLength, { message: ({ property }) => `${property} debe tener al menos ${minLength} caracteres` })] : []),
        ...(maxLength !== undefined ? [MaxLength(maxLength, { message: ({ property }) => `${property} no puede exceder ${maxLength} caracteres` })] : [])
    );
}
