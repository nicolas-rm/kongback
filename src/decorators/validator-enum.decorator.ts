import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, ValidationArguments } from 'class-validator';

export interface ValidatorEnumOptions {
    optional?: boolean;
    emptyTo?: 'undefined' | 'null';
    message?: string;
    toLowerCase?: boolean;
    toUpperCase?: boolean;
}

function buildMessage(message: string | undefined, fallback: (property: string, values: string[]) => string) {
    return (args: ValidationArguments) => {
        if (message) return message;
        const values = Object.values(args.constraints[0]) as string[];
        return fallback(args.property, values);
    };
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
            ? [IsIn(enumOrValues as string[], { message: buildMessage(message, (property, values) => `${property} debe ser uno de: ${values.join(', ')}`) })]
            : [IsEnum(enumOrValues as T, { message: buildMessage(message, (property, values) => `${property} debe ser uno de: ${values.join(', ')}`) })])
    );
}
