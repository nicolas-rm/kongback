import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

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

        response.status(resolved.status).json({
            statusCode: resolved.status,
            message: resolved.message,
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }

    private resolvePrismaError(exception: unknown): { status: number; message: string } {
        if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            if (exception.code === 'P2002') return { status: HttpStatus.CONFLICT, message: `El valor de (${this.resolveUniqueFields(exception)}) ya existe` };
            if (exception.code === 'P2003') return { status: HttpStatus.BAD_REQUEST, message: 'Relacion invalida' };
            if (exception.code === 'P2000') return { status: HttpStatus.BAD_REQUEST, message: 'Valor demasiado largo' };
            if (exception.code === 'P2025') return { status: HttpStatus.NOT_FOUND, message: 'Registro no encontrado' };
        }

        if (exception instanceof Prisma.PrismaClientValidationError) return { status: HttpStatus.BAD_REQUEST, message: 'Datos no validos' };

        return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Falla interna del servidor' };
    }

    private resolveUniqueFields(exception: Prisma.PrismaClientKnownRequestError): string {
        const target = exception.meta?.target;
        if (Array.isArray(target)) return target.map(String).join(', ');
        if (typeof target === 'string') return target;
        return 'desconocido';
    }
}
