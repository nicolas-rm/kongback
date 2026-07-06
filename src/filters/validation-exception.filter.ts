import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import type { Request, Response } from 'express';
import { I18nContext, I18nValidationException } from 'nestjs-i18n';
import { RequestValidationException } from '@/configurations/request-validation';
import { formatValidationErrors } from '@/configurations/validation-messages';
import { ERROR_CODES } from '@/errors/error-codes';
import { buildErrorResponse } from '@/errors/error-response';
import { I18N_KEYS, translateI18n } from '@/i18n';

@Catch(RequestValidationException, I18nValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
    catch(exception: RequestValidationException | I18nValidationException, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();
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
    }

    private formatI18nValidationErrors(exception: I18nValidationException, host: ArgumentsHost) {
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
