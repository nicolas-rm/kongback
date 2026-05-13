import type { ValidationError } from 'class-validator';
import type { ErrorDetail } from '@/errors/error-response';

type MessageFormatter = (message: string, error: ValidationError) => string;

export function formatValidationErrors(errors: ValidationError[], formatter?: MessageFormatter): ErrorDetail[] {
    const messages: ErrorDetail[] = [];

    for (const error of errors) {
        collectValidationMessages(error, messages, '', formatter);
    }

    return messages;
}

function collectValidationMessages(error: ValidationError, messages: ErrorDetail[], parentPath = '', formatter?: MessageFormatter) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
        messages.push(
            ...Object.values(error.constraints).map((message) => ({
                field: path,
                message: formatter ? formatter(message, error) : message,
            }))
        );
    }

    for (const child of error.children ?? []) {
        collectValidationMessages(child, messages, path, formatter);
    }
}
