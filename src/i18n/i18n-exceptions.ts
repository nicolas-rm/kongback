import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@/errors/error-codes';
import { resolveDefaultErrorCode } from '@/errors/error-response';
import type { I18nKey } from '@/i18n/i18n-keys';

export type I18nExceptionOptions = {
    code?: ErrorCode;
    args?: Record<string, unknown>;
    extra?: Record<string, unknown>;
};

export class I18nHttpException extends HttpException {
    constructor(statusCode: HttpStatus, i18nKey: I18nKey, fallbackMessage: string, options: I18nExceptionOptions = {}) {
        super(
            {
                statusCode,
                code: options.code ?? resolveDefaultErrorCode(statusCode),
                message: fallbackMessage,
                i18nKey,
                ...(options.args ? { i18nArgs: options.args } : {}),
                ...(options.extra ?? {}),
            },
            statusCode
        );
    }
}

export class I18nBadRequestException extends I18nHttpException {
    constructor(i18nKey: I18nKey, fallbackMessage: string, options?: I18nExceptionOptions) {
        super(HttpStatus.BAD_REQUEST, i18nKey, fallbackMessage, options);
    }
}

export class I18nUnauthorizedException extends I18nHttpException {
    constructor(i18nKey: I18nKey, fallbackMessage: string, options?: I18nExceptionOptions) {
        super(HttpStatus.UNAUTHORIZED, i18nKey, fallbackMessage, options);
    }
}

export class I18nForbiddenException extends I18nHttpException {
    constructor(i18nKey: I18nKey, fallbackMessage: string, options?: I18nExceptionOptions) {
        super(HttpStatus.FORBIDDEN, i18nKey, fallbackMessage, options);
    }
}

export class I18nNotFoundException extends I18nHttpException {
    constructor(i18nKey: I18nKey, fallbackMessage: string, options?: I18nExceptionOptions) {
        super(HttpStatus.NOT_FOUND, i18nKey, fallbackMessage, options);
    }
}
