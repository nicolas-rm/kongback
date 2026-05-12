import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ERROR_CODES, type ErrorCode } from '@/errors/error-codes';
import { buildErrorResponse } from '@/errors/error-response';

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError, Prisma.PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(PrismaExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();
        const resolved = this.resolvePrismaError(exception);

        if (resolved.status >= 500) {
            this.logger.error(`${resolved.status} ${resolved.message} path=${request.url} method=${request.method}`, exception instanceof Error ? exception.stack : undefined);
        }

        response.status(resolved.status).json(buildErrorResponse({ statusCode: resolved.status, code: resolved.code, message: resolved.message, path: request.url }));
    }

    private resolvePrismaError(exception: unknown): { status: number; code: ErrorCode; message: string } {
        if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            if (exception.code === 'P2002') return { status: HttpStatus.CONFLICT, code: ERROR_CODES.UNIQUE_CONSTRAINT, message: `El valor de (${this.resolveUniqueFields(exception)}) ya existe` };
            if (exception.code === 'P2003') return { status: HttpStatus.BAD_REQUEST, code: ERROR_CODES.INVALID_RELATION, message: 'Relacion invalida' };
            if (exception.code === 'P2000') return { status: HttpStatus.BAD_REQUEST, code: ERROR_CODES.VALUE_TOO_LONG, message: 'Valor demasiado largo' };
            if (exception.code === 'P2025') return { status: HttpStatus.NOT_FOUND, code: ERROR_CODES.NOT_FOUND, message: 'Registro no encontrado' };
        }

        if (exception instanceof Prisma.PrismaClientValidationError) return { status: HttpStatus.BAD_REQUEST, code: ERROR_CODES.PRISMA_VALIDATION_ERROR, message: 'Datos no validos' };

        return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Falla interna del servidor' };
    }

    private resolveUniqueFields(exception: Prisma.PrismaClientKnownRequestError): string {
        const target = exception.meta?.target;
        if (Array.isArray(target)) return target.map(String).join(', ');
        if (typeof target === 'string') return target;
        return 'desconocido';
    }
}
