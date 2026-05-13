import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import { buildErrorResponse, type ErrorDetail } from '@/errors/error-response';
import type { ErrorCode } from '@/errors/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();
        const isHttpException = exception instanceof HttpException;
        const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        const details = isHttpException ? this.resolveHttpDetails(exception, status) : { message: 'Solicitud no procesada, intente nuevamente mas tarde' };

        if (status >= 500) {
            this.logger.error(`${status} ${details.message} path=${request.url} method=${request.method}`, exception instanceof Error ? exception.stack : undefined);
        }

        response.status(status).json(buildErrorResponse({ statusCode: status, message: details.message, code: details.code, errors: details.errors, path: request.url }));
    }

    private resolveHttpDetails(exception: HttpException, status: number): { message: string; code?: ErrorCode; errors?: ErrorDetail[] } {
        const body = exception.getResponse();

        if (typeof body === 'string') return { message: body || this.defaultMessage(status) };
        if (body && typeof body === 'object') {
            const payload = body as { message?: string | string[]; code?: ErrorCode; errors?: ErrorDetail[] };
            const message = Array.isArray(payload.message) ? payload.message.join('; ') : payload.message;
            return {
                message: message || this.defaultMessage(status),
                code: payload.code,
                errors: payload.errors,
            };
        }

        return { message: this.defaultMessage(status) };
    }

    private defaultMessage(status: number): string {
        return STATUS_CODES[status] ?? 'Error';
    }
}
