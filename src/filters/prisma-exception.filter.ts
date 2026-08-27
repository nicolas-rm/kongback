import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';
import { ERROR_CODES, type ErrorCode } from '@/errors/error-codes';
import { buildErrorResponse } from '@/errors/error-response';
import { I18N_KEYS, translateI18n } from '@/i18n';
import type { I18nKey } from '@/i18n';

const UNIQUE_FIELD_LABELS_BY_LANGUAGE = {
    es: {
        assignedCardId: 'la tarjeta asignada',
        card_external_id: 'el ID externo de tarjeta',
        cardcloud_subaccount_id: 'la subcuenta Cardcloud',
        cardcloudSubaccountId: 'la subcuenta Cardcloud',
        challengeHash: 'el desafio de seguridad',
        code: 'el codigo',
        codeHash: 'el codigo',
        companyId: 'la compania',
        economicNumber: 'el numero economico',
        email: 'el correo electronico',
        external_id: 'el ID externo',
        externalId: 'el ID externo',
        externalReference: 'la referencia externa',
        fuelId: 'el combustible',
        key: 'la clave',
        name: 'el nombre',
        plates: 'las placas',
        provider: 'el proveedor',
        providerSubject: 'el identificador del proveedor',
        stationId: 'la estacion',
        stationNumber: 'el numero de estacion',
        storageKey: 'el archivo',
        subCompanyId: 'la subcompania',
        tokenHash: 'el token',
        userId: 'el usuario',
        username: 'el usuario',
        vehicleId: 'el vehiculo',
    },
    en: {
        assignedCardId: 'assigned card',
        card_external_id: 'external card ID',
        cardcloud_subaccount_id: 'Cardcloud subaccount',
        cardcloudSubaccountId: 'Cardcloud subaccount',
        challengeHash: 'security challenge',
        code: 'code',
        codeHash: 'code',
        companyId: 'company',
        economicNumber: 'economic number',
        email: 'email address',
        external_id: 'external ID',
        externalId: 'external ID',
        externalReference: 'external reference',
        fuelId: 'fuel',
        key: 'key',
        name: 'name',
        plates: 'plates',
        provider: 'provider',
        providerSubject: 'provider identifier',
        stationId: 'station',
        stationNumber: 'station number',
        storageKey: 'file',
        subCompanyId: 'sub-company',
        tokenHash: 'token',
        userId: 'user',
        username: 'username',
        vehicleId: 'vehicle',
    },
} as const;

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
                const uniqueConflict = this.resolveUniqueConflict(exception, host);
                return this.buildPrismaError(
                    host,
                    HttpStatus.CONFLICT,
                    ERROR_CODES.UNIQUE_CONSTRAINT,
                    I18N_KEYS.prisma.uniqueConstraint,
                    `${uniqueConflict.fields} ${uniqueConflict.existsVerb}.`,
                    uniqueConflict
                );
            }
            if (exception.code === 'P2003')
                return this.buildPrismaError(host, HttpStatus.BAD_REQUEST, ERROR_CODES.INVALID_RELATION, I18N_KEYS.prisma.invalidRelation, 'Algunos datos relacionados no son validos.');
            if (exception.code === 'P2000')
                return this.buildPrismaError(host, HttpStatus.BAD_REQUEST, ERROR_CODES.VALUE_TOO_LONG, I18N_KEYS.prisma.valueTooLong, 'Uno de los campos supera el tamano permitido.');
            if (exception.code === 'P2025') return this.buildPrismaError(host, HttpStatus.NOT_FOUND, ERROR_CODES.NOT_FOUND, I18N_KEYS.prisma.recordNotFound, 'No encontramos el registro solicitado.');
        }

        if (exception instanceof Prisma.PrismaClientValidationError)
            return this.buildPrismaError(host, HttpStatus.BAD_REQUEST, ERROR_CODES.PRISMA_VALIDATION_ERROR, I18N_KEYS.prisma.invalidData, 'Revisa la informacion enviada.');

        return this.buildPrismaError(
            host,
            HttpStatus.INTERNAL_SERVER_ERROR,
            ERROR_CODES.INTERNAL_SERVER_ERROR,
            I18N_KEYS.prisma.internalFailure,
            'No pudimos procesar la solicitud. Intenta nuevamente mas tarde.'
        );
    }

    private buildPrismaError(
        host: ArgumentsHost,
        status: number,
        code: ErrorCode,
        key: I18nKey,
        fallback: string,
        args?: Record<string, unknown>
    ): { status: number; code: ErrorCode; message: string } {
        return { status, code, message: translateI18n(host, key, fallback, args) };
    }

    private resolveUniqueConflict(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): { fields: string; existsVerb: string } {
        const fields = this.resolveUniqueFieldNames(exception);
        if (fields.length > 0) return this.formatUniqueConflict(fields, host);

        return {
            fields: translateI18n(host, I18N_KEYS.prisma.unknownField, 'desconocido'),
            existsVerb: this.existsVerb(host, false),
        };
    }

    private resolveUniqueFieldNames(exception: Prisma.PrismaClientKnownRequestError): string[] {
        const target = exception.meta?.target;
        if (Array.isArray(target)) return this.cleanFieldNames(target.map(String));
        if (typeof target === 'string') return this.cleanFieldNames([target]);
        const fieldsFromMessage = this.resolveUniqueFieldsFromMessage(exception.message);
        if (fieldsFromMessage) return fieldsFromMessage;
        return [];
    }

    private resolveUniqueFieldsFromMessage(message: string): string[] | null {
        const match = /Unique constraint failed on the fields?: \(([^)]+)\)/.exec(message);
        if (!match?.[1]) return null;

        const fields = this.cleanFieldNames(match[1].split(',').map((field) => field.trim()));

        return fields.length > 0 ? fields : null;
    }

    private cleanFieldNames(fields: string[]): string[] {
        return fields.map((field) => field.trim().replace(/[`"\\]/g, '')).filter(Boolean);
    }

    private formatUniqueConflict(fields: string[], host: ArgumentsHost): { fields: string; existsVerb: string } {
        const labels = this.uniqueFieldLabels(host);
        const language = this.resolveLanguage(host);
        const fieldLabels = fields.map((field) => labels[field as keyof typeof labels] ?? field);
        const isCombination = fieldLabels.length > 1;

        if (language === 'en') {
            return {
                fields: isCombination ? `The combination of ${this.joinFieldLabels(fieldLabels, 'and')}` : this.capitalize(fieldLabels[0]),
                existsVerb: 'already exists',
            };
        }

        if (language === 'es') {
            return {
                fields: isCombination ? `La combinacion de ${this.joinFieldLabels(fieldLabels, 'y')}` : this.capitalize(fieldLabels[0]),
                existsVerb: this.existsVerb(host, fieldLabels[0] === 'las placas'),
            };
        }

        return {
            fields: isCombination ? fieldLabels.join(', ') : fieldLabels[0],
            existsVerb: this.existsVerb(host, false),
        };
    }

    private uniqueFieldLabels(host: ArgumentsHost) {
        const language = this.resolveLanguage(host);
        return language ? UNIQUE_FIELD_LABELS_BY_LANGUAGE[language] : {};
    }

    private resolveLanguage(host: ArgumentsHost): keyof typeof UNIQUE_FIELD_LABELS_BY_LANGUAGE | null {
        const contextLanguage = (I18nContext.current(host) ?? I18nContext.current())?.lang;
        const language = contextLanguage?.split(',')[0]?.trim().split('-')[0]?.toLowerCase();
        if (!language || language === 'es') return 'es';
        if (language === 'en') return 'en';
        return null;
    }

    private joinFieldLabels(labels: string[], conjunction: string): string {
        if (labels.length <= 1) return labels[0] ?? '';
        if (labels.length === 2) return `${labels[0]} ${conjunction} ${labels[1]}`;
        return `${labels.slice(0, -1).join(', ')} ${conjunction} ${labels[labels.length - 1]}`;
    }

    private capitalize(value: string): string {
        if (!value) return value;
        return `${value[0].toUpperCase()}${value.slice(1)}`;
    }

    private existsVerb(host: ArgumentsHost, plural: boolean): string {
        const language = this.resolveLanguage(host);
        if (language === 'en') return 'already exists';
        if (language === 'es') return plural ? 'ya existen' : 'ya existe';
        return '';
    }
}
