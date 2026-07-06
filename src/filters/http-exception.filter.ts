import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import { I18nContext, I18nValidationException } from 'nestjs-i18n';
import { RequestValidationException } from '@/configurations/request-validation';
import { formatValidationErrors } from '@/configurations/validation-messages';
import { ERROR_CODES } from '@/errors/error-codes';
import { buildErrorResponse, type ErrorDetail } from '@/errors/error-response';
import { I18N_KEYS, type I18nKey, translateI18n } from '@/i18n';
import type { ErrorCode } from '@/errors/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();

        if (exception instanceof RequestValidationException || exception instanceof I18nValidationException) {
            const errors = exception instanceof RequestValidationException ? exception.errors : this.formatI18nValidationErrors(exception, host);
            response.status(HttpStatus.BAD_REQUEST).json(
                buildErrorResponse({
                    statusCode: HttpStatus.BAD_REQUEST,
                    code: ERROR_CODES.VALIDATION_ERROR,
                    message: translateI18n(host, I18N_KEYS.errors.validation.invalidData, 'La solicitud contiene datos invalidos'),
                    errors,
                    path: request.url,
                })
            );
            return;
        }

        const isHttpException = exception instanceof HttpException;
        const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        const details = isHttpException
            ? this.resolveHttpDetails(exception, status, host)
            : { message: translateI18n(host, I18N_KEYS.errors.internal.unprocessed, 'Solicitud no procesada, intente nuevamente mas tarde') };

        if (status >= 500) {
            this.logger.error(`${status} ${details.message} path=${request.url} method=${request.method}`, exception instanceof Error ? exception.stack : undefined);
        }

        response.status(status).json(buildErrorResponse({ statusCode: status, message: details.message, code: details.code, errors: details.errors, path: request.url }));
    }

    private resolveHttpDetails(exception: HttpException, status: number, host: ArgumentsHost): { message: string; code?: ErrorCode; errors?: ErrorDetail[] } {
        const body = exception.getResponse();

        if (typeof body === 'string') return { message: body || this.defaultMessage(status) };
        if (body && typeof body === 'object') {
            const payload = body as { message?: string | string[]; code?: ErrorCode; errors?: ErrorDetail[]; i18nKey?: I18nKey; i18nArgs?: Record<string, unknown> };
            const message = Array.isArray(payload.message) ? payload.message.join('; ') : payload.message;
            return {
                message: payload.i18nKey ? translateI18n(host, payload.i18nKey, message || this.defaultMessage(status), payload.i18nArgs) : message || this.defaultMessage(status),
                code: payload.code,
                errors: payload.errors,
            };
        }

        return { message: this.defaultMessage(status) };
    }

    private defaultMessage(status: number): string {
        return STATUS_CODES[status] ?? 'Error';
    }

    private formatI18nValidationErrors(exception: I18nValidationException, host: ArgumentsHost): ErrorDetail[] {
        const i18n = I18nContext.current(host) ?? I18nContext.current();

        return formatValidationErrors(exception.errors, (message, error) => {
            if (!i18n) return message;
            return translateValidationMessage(message, error, i18n);
        });
    }
}

function translateValidationMessage(message: string, error: ValidationError, i18n: I18nContext): string {
    const separatorIndex = message.indexOf('|');
    const key = separatorIndex === -1 ? message : message.slice(0, separatorIndex);
    const args = parseValidationArgs(separatorIndex === -1 ? '' : message.slice(separatorIndex + 1));
    const constraints = Array.isArray(args.constraints) ? Object.fromEntries(args.constraints.map((value, index) => [index.toString(), value])) : error.constraints;
    const translated = i18n.t(key, {
        args: {
            property: error.property,
            value: error.value,
            target: error.target,
            contexts: error.contexts,
            ...args,
            constraints,
        },
    }) as string;

    return translated && translated !== key ? translated : key;
}

function parseValidationArgs(args: string): Record<string, unknown> {
    if (!args) return {};
    try {
        return JSON.parse(args) as Record<string, unknown>;
    } catch {
        return {};
    }
}
