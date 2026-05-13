import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@/errors/error-codes';
import type { ErrorDetail } from '@/errors/error-response';

export class RequestValidationException extends BadRequestException {
    constructor(public readonly errors: ErrorDetail[]) {
        super({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'La solicitud contiene datos invalidos',
            errors,
        });
    }
}
