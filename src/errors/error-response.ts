import { STATUS_CODES } from 'node:http';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@/errors/error-codes';

export type ErrorDetail = {
    field?: string;
    message: string;
};

export type ErrorResponseInput = {
    statusCode: number;
    message: string;
    code?: ErrorCode;
    path: string;
    errors?: ErrorDetail[];
};

export function buildErrorResponse(input: ErrorResponseInput) {
    return {
        statusCode: input.statusCode,
        code: input.code ?? resolveDefaultErrorCode(input.statusCode),
        message: input.message || STATUS_CODES[input.statusCode] || 'Error',
        ...(input.errors ? { errors: input.errors } : {}),
        path: input.path,
        timestamp: new Date().toISOString(),
    };
}

export function resolveDefaultErrorCode(statusCode: number): ErrorCode {
    if (statusCode === HttpStatus.BAD_REQUEST) return ERROR_CODES.BAD_REQUEST;
    if (statusCode === HttpStatus.UNAUTHORIZED) return ERROR_CODES.UNAUTHORIZED;
    if (statusCode === HttpStatus.FORBIDDEN) return ERROR_CODES.FORBIDDEN;
    if (statusCode === HttpStatus.NOT_FOUND) return ERROR_CODES.NOT_FOUND;
    if (statusCode === HttpStatus.CONFLICT) return ERROR_CODES.CONFLICT;
    return ERROR_CODES.INTERNAL_SERVER_ERROR;
}
