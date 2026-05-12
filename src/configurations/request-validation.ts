import { BadRequestException } from '@nestjs/common';

export class RequestValidationException extends BadRequestException {
    constructor(public readonly errors: string[]) {
        super({
            statusCode: 400,
            message: errors.length > 0 ? errors.join('; ') : 'Error de validacion',
            errors,
        });
    }
}
