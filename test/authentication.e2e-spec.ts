import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Response } from 'express';
import { AuthenticationController } from '@/modules/authentication/authentication.controller';
import { AuthenticationService } from '@/modules/authentication/authentication.service';
import { AuthenticationCookiesService } from '@/modules/authentication/services/authentication-cookies.service';

function getSetCookieHeader(headers: request.Response['headers']): string {
    const cookies = headers['set-cookie'];
    return Array.isArray(cookies) ? cookies.join(';') : String(cookies ?? '');
}

describe('AuthenticationController (e2e)', () => {
    let app: INestApplication;
    const authenticationService = {
        login: jest.fn(),
        verifyTwoFactorLogin: jest.fn(),
        register: jest.fn(),
        refresh: jest.fn(),
        requestPasswordReset: jest.fn(),
        resetPassword: jest.fn(),
        requestEmailVerification: jest.fn(),
        verifyEmail: jest.fn(),
    };
    const authenticationCookiesService = {
        setAuthenticationCookies: jest.fn((response: Response, accessToken: string, refreshToken: string) => {
            response.cookie('access_token', accessToken, { httpOnly: true, path: '/' });
            response.cookie('refresh_token', refreshToken, { httpOnly: true, path: '/' });
        }),
        clearAuthenticationCookies: jest.fn((response: Response) => {
            response.clearCookie('access_token', { path: '/' });
            response.clearCookie('refresh_token', { path: '/' });
        }),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [AuthenticationController],
            providers: [
                { provide: AuthenticationService, useValue: authenticationService },
                { provide: AuthenticationCookiesService, useValue: authenticationCookiesService },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('sets authentication cookies on password login', async () => {
        authenticationService.login.mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token', sessionId: 'session-id' });

        await request(app.getHttpServer())
            .post('/authentication/login')
            .send({ username: 'admin', password: 'secret' })
            .expect(200)
            .expect(({ body, headers }) => {
                const cookies = getSetCookieHeader(headers);
                expect(body).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token', sessionId: 'session-id' });
                expect(cookies).toContain('access_token=access-token');
                expect(cookies).toContain('refresh_token=refresh-token');
            });
    });

    it('returns a 2fa challenge without authentication cookies when user has 2fa enabled', async () => {
        authenticationService.login.mockResolvedValue({ requiresTwoFactor: true, challengeToken: 'challenge-token' });

        await request(app.getHttpServer())
            .post('/authentication/login')
            .send({ username: 'admin', password: 'secret' })
            .expect(200)
            .expect(({ body, headers }) => {
                const cookies = getSetCookieHeader(headers);
                expect(body).toEqual({ requiresTwoFactor: true, challengeToken: 'challenge-token' });
                expect(cookies).toContain('access_token=');
                expect(cookies).toContain('refresh_token=');
            });
    });

    it('sets authentication cookies after 2fa login verification', async () => {
        authenticationService.verifyTwoFactorLogin.mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token', sessionId: 'session-id' });

        await request(app.getHttpServer())
            .post('/authentication/2fa/verify-login')
            .send({ challengeToken: 'challenge-token', code: '123456' })
            .expect(200)
            .expect(({ body, headers }) => {
                const cookies = getSetCookieHeader(headers);
                expect(body).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token', sessionId: 'session-id' });
                expect(cookies).toContain('access_token=access-token');
                expect(cookies).toContain('refresh_token=refresh-token');
            });
    });

    it('keeps email verification endpoints simple and explicit', async () => {
        authenticationService.requestEmailVerification.mockResolvedValue({ accepted: true });
        authenticationService.verifyEmail.mockResolvedValue({ emailVerified: true });

        await request(app.getHttpServer()).post('/authentication/email/verification/request').send({ email: 'user@example.com' }).expect(200, { accepted: true });
        await request(app.getHttpServer()).post('/authentication/email/verification/confirm').send({ token: 'token' }).expect(200, { emailVerified: true });
    });
});
