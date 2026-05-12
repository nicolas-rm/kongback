import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsDate, IsDateString, IsOptional, ValidationArguments } from 'class-validator';

export interface ValidatorDateOptions {
    optional?: boolean;
    mode?: 'iso' | 'date';
    emptyTo?: 'undefined' | 'null';
    toDate?: boolean;
    message?: string;
}

function buildMessage(message: string | undefined, fallback: (property: string) => string) {
    return (args: ValidationArguments) => message ?? fallback(args.property);
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
            ? [IsDate({ message: buildMessage(message, (property) => `${property} debe ser una fecha valida`) })]
            : [IsDateString({}, { message: buildMessage(message, (property) => `${property} debe ser una fecha ISO valida`) })])
    );
}
