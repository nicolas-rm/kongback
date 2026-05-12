import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequestValidationException } from '@/configurations/request-validation';

@Catch(RequestValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
    catch(exception: RequestValidationException, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();
        const message = exception.errors.length > 0 ? exception.errors.join('; ') : 'Error de validacion';

        response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: HttpStatus.BAD_REQUEST,
            message,
            errors: exception.errors,
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }
}
