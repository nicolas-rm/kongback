import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequestValidationException } from '@/configurations/request-validation';
import { ERROR_CODES } from '@/errors/error-codes';
import { buildErrorResponse } from '@/errors/error-response';

@Catch(RequestValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
    catch(exception: RequestValidationException, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();

        response
            .status(HttpStatus.BAD_REQUEST)
            .json(
                buildErrorResponse({
                    statusCode: HttpStatus.BAD_REQUEST,
                    code: ERROR_CODES.VALIDATION_ERROR,
                    message: 'La solicitud contiene datos invalidos',
                    errors: exception.errors,
                    path: request.url,
                })
            );
    }
}
