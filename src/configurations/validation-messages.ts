import type { ValidationError } from 'class-validator';
import type { ErrorDetail } from '@/errors/error-response';

export function formatValidationErrors(errors: ValidationError[]): ErrorDetail[] {
    const messages: ErrorDetail[] = [];

    for (const error of errors) {
        collectValidationMessages(error, messages);
    }

    return messages;
}

function collectValidationMessages(error: ValidationError, messages: ErrorDetail[], parentPath = '') {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
        messages.push(
            ...Object.values(error.constraints).map((message) => ({
                field: path,
                message,
            }))
        );
    }

    for (const child of error.children ?? []) {
        collectValidationMessages(child, messages, path);
    }
}
