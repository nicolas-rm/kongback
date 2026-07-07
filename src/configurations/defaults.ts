export const APP_DEFAULTS = {
    name: 'Kong',
    port: 3000,
    nodeEnv: 'development',
    jwt: {
        accessExpiresIn: '15m',
        refreshExpiresIn: '7d',
    },
    session: {
        idleTimeoutMinutes: 60,
        totalMinutes: 7 * 24 * 60,
        touchIntervalSeconds: 30,
        lockDurationMinutes: 15,
        maxFailedAttempts: 5,
        maxActiveSessions: 5,
        passwordResetTtlMinutes: 60,
        emailVerificationTtlMinutes: 60,
    },
    twoFactor: {
        setupTtlMinutes: 10,
        setupQrRotateSeconds: 120,
        loginChallengeTtlMinutes: 10,
        loginChallengeMaxAttempts: 5,
        recoveryCodesCount: 8,
        totpDigits: 6,
        totpPeriodSeconds: 30,
        totpWindow: 1,
    },
    mail: {
        driver: 'smtp',
        host: 'localhost',
        port: 587,
        user: '',
        password: '',
    },
    documents: {
        storageDir: 'uploads/documents',
        maxFileSizeMb: 20,
        allowedMimeTypes: 'application/pdf,image/jpeg,image/png,image/webp,text/plain',
    },
    security: {
        allowedOrigins: '',
    },
} as const;
