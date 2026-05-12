import type { ValidationError } from 'class-validator';

export function formatValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
        collectValidationMessages(error, messages);
    }

    return messages;
}

function collectValidationMessages(error: ValidationError, messages: string[], parentPath = '') {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
        messages.push(...Object.values(error.constraints).map((message) => `${path}: ${message}`));
    }

    for (const child of error.children ?? []) {
        collectValidationMessages(child, messages, path);
    }
}
