import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import { buildErrorResponse } from '@/errors/error-response';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();
        const isHttpException = exception instanceof HttpException;
        const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        const message = isHttpException ? this.resolveHttpMessage(exception, status) : 'Solicitud no procesada, intente nuevamente mas tarde';

        if (status >= 500) {
            this.logger.error(`${status} ${message} path=${request.url} method=${request.method}`, exception instanceof Error ? exception.stack : undefined);
        }

        response.status(status).json(buildErrorResponse({ statusCode: status, message, path: request.url }));
    }

    private resolveHttpMessage(exception: HttpException, status: number): string {
        const body = exception.getResponse();

        if (typeof body === 'string') return body || this.defaultMessage(status);
        if (body && typeof body === 'object') {
            const message = (body as { message?: string | string[] }).message;
            if (Array.isArray(message)) return message.join('; ');
            if (message) return message;
        }

        return this.defaultMessage(status);
    }

    private defaultMessage(status: number): string {
        return STATUS_CODES[status] ?? 'Error';
    }
}
