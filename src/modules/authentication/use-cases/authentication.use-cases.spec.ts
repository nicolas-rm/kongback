import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { ChangePasswordUseCase, ListSessionsUseCase, LoginUseCase, LogoutUseCase, RefreshUseCase } from '@/modules/authentication/use-cases';

describe('Authentication use-cases', () => {
    const config = {
        session: {
            maxFailedAttempts: 3,
            lockDurationMinutes: 15,
        },
    };

    const buildRepository = () => ({
        findLoginUser: jest.fn(),
        resetLoginState: jest.fn(),
        updateFailedLoginState: jest.fn(),
        findStoredRefreshToken: jest.fn(),
        revokeRefreshToken: jest.fn(),
        revokeUserRefreshTokens: jest.fn(),
        listActiveSessions: jest.fn(),
        findUserForPasswordChange: jest.fn(),
        updatePassword: jest.fn(),
    });

    const cryptoService = {
        verifyPassword: jest.fn(),
        hashPassword: jest.fn(),
        hashToken: jest.fn((token: string) => `hash:${token}`),
    };

    const authTokensService = {
        issueTokens: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('issues tokens and resets login state on successful login', async () => {
        const repository = buildRepository();
        const useCase = new LoginUseCase(config as never, repository as never, cryptoService as never, authTokensService as never);
        const issuedTokens = { accessToken: 'access', refreshToken: 'refresh', sessionId: 'session-id' };

        repository.findLoginUser.mockResolvedValue({
            id: 'user-id',
            username: 'admin',
            passwordHash: 'hash',
            status: UserStatus.active,
            failedLoginAttempts: 2,
            lockedUntil: null,
        });
        cryptoService.verifyPassword.mockResolvedValue(true);
        authTokensService.issueTokens.mockResolvedValue(issuedTokens);

        await expect(useCase.execute({ username: 'admin', password: 'secret' }, { ipAddress: '127.0.0.1' })).resolves.toEqual(issuedTokens);
        expect(repository.resetLoginState).toHaveBeenCalledWith('user-id');
        expect(authTokensService.issueTokens).toHaveBeenCalledWith({ id: 'user-id', username: 'admin' }, { userAgent: undefined, ipAddress: '127.0.0.1', deviceName: undefined });
    });

    it('registers a failed login attempt when password is invalid', async () => {
        const repository = buildRepository();
        const useCase = new LoginUseCase(config as never, repository as never, cryptoService as never, authTokensService as never);

        repository.findLoginUser.mockResolvedValue({
            id: 'user-id',
            username: 'admin',
            passwordHash: 'hash',
            status: UserStatus.active,
            failedLoginAttempts: 2,
            lockedUntil: null,
        });
        cryptoService.verifyPassword.mockResolvedValue(false);

        await expect(useCase.execute({ username: 'admin', password: 'bad' })).rejects.toBeInstanceOf(UnauthorizedException);
        expect(repository.updateFailedLoginState).toHaveBeenCalledWith('user-id', 3, expect.any(Date));
    });

    it('rotates refresh token when stored token is active', async () => {
        const repository = buildRepository();
        const useCase = new RefreshUseCase(repository as never, cryptoService as never, authTokensService as never);
        const issuedTokens = { accessToken: 'new-access', refreshToken: 'new-refresh', sessionId: 'new-session' };

        repository.findStoredRefreshToken.mockResolvedValue({
            id: 'refresh-id',
            userId: 'user-id',
            expiresAt: new Date(Date.now() + 60_000),
            idleExpiresAt: new Date(Date.now() + 60_000),
            user: { id: 'user-id', username: 'admin', status: UserStatus.active },
        });
        authTokensService.issueTokens.mockResolvedValue(issuedTokens);

        await expect(useCase.execute({ refreshToken: 'refresh' })).resolves.toEqual(issuedTokens);
        expect(repository.findStoredRefreshToken).toHaveBeenCalledWith('hash:refresh');
        expect(repository.revokeRefreshToken).toHaveBeenCalledWith('refresh-id', expect.any(Date));
    });

    it('revokes all active refresh tokens on logout-all', async () => {
        const repository = buildRepository();
        const useCase = new LogoutUseCase(repository as never, cryptoService as never);

        repository.revokeUserRefreshTokens.mockResolvedValue({ count: 2 });

        await expect(useCase.execute('user-id', {})).resolves.toEqual({ userId: 'user-id', revokedSessions: 2 });
        expect(repository.revokeUserRefreshTokens).toHaveBeenCalledWith('user-id');
    });

    it('marks the current session in session list', async () => {
        const repository = buildRepository();
        const useCase = new ListSessionsUseCase(repository as never, cryptoService as never);

        repository.findStoredRefreshToken.mockResolvedValue({ sessionId: 'session-2' });
        repository.listActiveSessions.mockResolvedValue([{ id: 'session-1' }, { id: 'session-2' }]);

        await expect(useCase.execute('user-id', 'refresh')).resolves.toEqual([
            { id: 'session-1', isCurrent: false },
            { id: 'session-2', isCurrent: true },
        ]);
    });

    it('changes password and revokes active refresh tokens', async () => {
        const repository = buildRepository();
        const useCase = new ChangePasswordUseCase(repository as never, cryptoService as never);

        repository.findUserForPasswordChange.mockResolvedValue({ id: 'user-id', passwordHash: 'old-hash' });
        cryptoService.verifyPassword.mockResolvedValue(true);
        cryptoService.hashPassword.mockResolvedValue('new-hash');

        await expect(useCase.execute('user-id', { currentPassword: 'old', newPassword: 'new' })).resolves.toEqual({ userId: 'user-id', passwordChanged: true });
        expect(repository.updatePassword).toHaveBeenCalledWith('user-id', 'new-hash');
        expect(repository.revokeUserRefreshTokens).toHaveBeenCalledWith('user-id');
    });
});
