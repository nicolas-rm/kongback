import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@/errors/error-codes';
import { buildErrorResponse } from '@/errors/error-response';

describe('buildErrorResponse', () => {
    it('builds a consistent error payload', () => {
        expect(
            buildErrorResponse({
                statusCode: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.VALIDATION_ERROR,
                message: 'Datos no validos',
                errors: ['email debe ser valido'],
                path: '/api/users',
            })
        ).toMatchObject({
            statusCode: HttpStatus.BAD_REQUEST,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Datos no validos',
            errors: ['email debe ser valido'],
            path: '/api/users',
        });
    });
});
