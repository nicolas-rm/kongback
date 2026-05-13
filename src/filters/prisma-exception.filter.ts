import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ERROR_CODES, type ErrorCode } from '@/errors/error-codes';
import { buildErrorResponse } from '@/errors/error-response';
import { I18N_KEYS, translateI18n } from '@/i18n';
import type { I18nKey } from '@/i18n';

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError, Prisma.PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(PrismaExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();
        const resolved = this.resolvePrismaError(exception, host);

        if (resolved.status >= 500) {
            this.logger.error(`${resolved.status} ${resolved.message} path=${request.url} method=${request.method}`, exception instanceof Error ? exception.stack : undefined);
        }

        response.status(resolved.status).json(buildErrorResponse({ statusCode: resolved.status, code: resolved.code, message: resolved.message, path: request.url }));
    }

    private resolvePrismaError(exception: unknown, host: ArgumentsHost): { status: number; code: ErrorCode; message: string } {
        if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            if (exception.code === 'P2002') {
                const fields = this.resolveUniqueFields(exception, host);
                return this.buildPrismaError(host, HttpStatus.CONFLICT, ERROR_CODES.UNIQUE_CONSTRAINT, I18N_KEYS.prisma.uniqueConstraint, 'El valor de ({fields}) ya existe', { fields });
            }
            if (exception.code === 'P2003') return this.buildPrismaError(host, HttpStatus.BAD_REQUEST, ERROR_CODES.INVALID_RELATION, I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
            if (exception.code === 'P2000') return this.buildPrismaError(host, HttpStatus.BAD_REQUEST, ERROR_CODES.VALUE_TOO_LONG, I18N_KEYS.prisma.valueTooLong, 'Valor demasiado largo');
            if (exception.code === 'P2025') return this.buildPrismaError(host, HttpStatus.NOT_FOUND, ERROR_CODES.NOT_FOUND, I18N_KEYS.prisma.recordNotFound, 'Registro no encontrado');
        }

        if (exception instanceof Prisma.PrismaClientValidationError) return this.buildPrismaError(host, HttpStatus.BAD_REQUEST, ERROR_CODES.PRISMA_VALIDATION_ERROR, I18N_KEYS.prisma.invalidData, 'Datos no validos');

        return this.buildPrismaError(host, HttpStatus.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR, I18N_KEYS.prisma.internalFailure, 'Falla interna del servidor');
    }

    private buildPrismaError(host: ArgumentsHost, status: number, code: ErrorCode, key: I18nKey, fallback: string, args?: Record<string, unknown>): { status: number; code: ErrorCode; message: string } {
        return { status, code, message: translateI18n(host, key, fallback, args) };
    }

    private resolveUniqueFields(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): string {
        const target = exception.meta?.target;
        if (Array.isArray(target)) return target.map(String).join(', ');
        if (typeof target === 'string') return target;
        return translateI18n(host, I18N_KEYS.prisma.unknownField, 'desconocido');
    }
}
