import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
    name: process.env.APP_NAME ?? 'Kong',
    webUrl: process.env.APP_WEB_URL!,
    database: {
        url: process.env.DATABASE_URL!,
        directUrl: process.env.DIRECT_URL!,
    },
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET!,
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
        refreshSecret: process.env.JWT_REFRESH_SECRET!,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    session: {
        idleTimeoutMinutes: parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES ?? '60', 10),
        totalMinutes: parseInt(process.env.SESSION_TOTAL_MINUTES ?? `${7 * 24 * 60}`, 10),
        touchIntervalSeconds: parseInt(process.env.SESSION_TOUCH_INTERVAL_SECONDS ?? '30', 10),
        lockDurationMinutes: parseInt(process.env.LOGIN_LOCK_DURATION_MINUTES ?? '15', 10),
        maxFailedAttempts: parseInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS ?? '5', 10),
        passwordResetTtlMinutes: parseInt(process.env.PASSWORD_RESET_TTL_MINUTES ?? '60', 10),
        emailVerificationTtlMinutes: parseInt(process.env.EMAIL_VERIFICATION_TTL_MINUTES ?? '60', 10),
        organizationInvitationTtlHours: parseInt(process.env.ORGANIZATION_INVITATION_TTL_HOURS ?? '72', 10),
    },
    twoFactor: {
        issuer: process.env.TWO_FACTOR_ISSUER ?? process.env.APP_NAME ?? 'Kong',
        setupTtlMinutes: parseInt(process.env.TWO_FACTOR_SETUP_TTL_MINUTES ?? '10', 10),
        setupQrRotateSeconds: parseInt(process.env.TWO_FACTOR_SETUP_QR_ROTATE_SECONDS ?? '120', 10),
        loginChallengeTtlMinutes: parseInt(process.env.TWO_FACTOR_LOGIN_CHALLENGE_TTL_MINUTES ?? '10', 10),
        loginChallengeMaxAttempts: parseInt(process.env.TWO_FACTOR_LOGIN_CHALLENGE_MAX_ATTEMPTS ?? '5', 10),
        recoveryCodesCount: parseInt(process.env.TWO_FACTOR_RECOVERY_CODES_COUNT ?? '8', 10),
        totpDigits: parseInt(process.env.TWO_FACTOR_TOTP_DIGITS ?? '6', 10),
        totpPeriodSeconds: parseInt(process.env.TWO_FACTOR_TOTP_PERIOD_SECONDS ?? '30', 10),
        totpWindow: parseInt(process.env.TWO_FACTOR_TOTP_WINDOW ?? '1', 10),
    },
    mail: {
        driver: process.env.MAIL_DRIVER ?? 'smtp',
        host: process.env.MAIL_HOST ?? 'localhost',
        port: parseInt(process.env.MAIL_PORT ?? '587', 10),
        secure: process.env.MAIL_SECURE === 'true',
        user: process.env.MAIL_USER ?? '',
        password: process.env.MAIL_PASSWORD ?? '',
        from: process.env.MAIL_FROM!,
        webUrl: process.env.APP_WEB_URL!,
    },
    encryption: {
        key: process.env.ENCRYPTION_KEY!,
    },
    documents: {
        storageDir: process.env.DOCUMENTS_STORAGE_DIR ?? 'uploads/documents',
        maxFileSizeMb: parseInt(process.env.DOCUMENTS_MAX_FILE_SIZE_MB ?? '20', 10),
        allowedMimeTypes: (process.env.DOCUMENTS_ALLOWED_MIME_TYPES ?? 'application/pdf,image/jpeg,image/png,image/webp,text/plain')
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean),
    },
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
}));
