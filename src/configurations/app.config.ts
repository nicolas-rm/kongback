import { registerAs } from '@nestjs/config';
import { APP_DEFAULTS } from '@/configurations/defaults';

function parseEnvInt(name: string, fallback: number): number {
    return parseInt(process.env[name] ?? `${fallback}`, 10);
}

export default registerAs('app', () => ({
    name: process.env.APP_NAME ?? APP_DEFAULTS.name,
    webUrl: process.env.APP_WEB_URL!,
    database: {
        url: process.env.DATABASE_URL!,
        directUrl: process.env.DIRECT_URL!,
    },
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET!,
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? APP_DEFAULTS.jwt.accessExpiresIn,
        refreshSecret: process.env.JWT_REFRESH_SECRET!,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? APP_DEFAULTS.jwt.refreshExpiresIn,
    },
    session: {
        idleTimeoutMinutes: parseEnvInt('SESSION_IDLE_TIMEOUT_MINUTES', APP_DEFAULTS.session.idleTimeoutMinutes),
        totalMinutes: parseEnvInt('SESSION_TOTAL_MINUTES', APP_DEFAULTS.session.totalMinutes),
        touchIntervalSeconds: parseEnvInt('SESSION_TOUCH_INTERVAL_SECONDS', APP_DEFAULTS.session.touchIntervalSeconds),
        lockDurationMinutes: parseEnvInt('LOGIN_LOCK_DURATION_MINUTES', APP_DEFAULTS.session.lockDurationMinutes),
        maxFailedAttempts: parseEnvInt('LOGIN_MAX_FAILED_ATTEMPTS', APP_DEFAULTS.session.maxFailedAttempts),
        passwordResetTtlMinutes: parseEnvInt('PASSWORD_RESET_TTL_MINUTES', APP_DEFAULTS.session.passwordResetTtlMinutes),
        emailVerificationTtlMinutes: parseEnvInt('EMAIL_VERIFICATION_TTL_MINUTES', APP_DEFAULTS.session.emailVerificationTtlMinutes),
        organizationInvitationTtlHours: parseEnvInt('ORGANIZATION_INVITATION_TTL_HOURS', APP_DEFAULTS.session.organizationInvitationTtlHours),
    },
    twoFactor: {
        issuer: process.env.TWO_FACTOR_ISSUER ?? process.env.APP_NAME ?? APP_DEFAULTS.name,
        setupTtlMinutes: parseEnvInt('TWO_FACTOR_SETUP_TTL_MINUTES', APP_DEFAULTS.twoFactor.setupTtlMinutes),
        setupQrRotateSeconds: parseEnvInt('TWO_FACTOR_SETUP_QR_ROTATE_SECONDS', APP_DEFAULTS.twoFactor.setupQrRotateSeconds),
        loginChallengeTtlMinutes: parseEnvInt('TWO_FACTOR_LOGIN_CHALLENGE_TTL_MINUTES', APP_DEFAULTS.twoFactor.loginChallengeTtlMinutes),
        loginChallengeMaxAttempts: parseEnvInt('TWO_FACTOR_LOGIN_CHALLENGE_MAX_ATTEMPTS', APP_DEFAULTS.twoFactor.loginChallengeMaxAttempts),
        recoveryCodesCount: parseEnvInt('TWO_FACTOR_RECOVERY_CODES_COUNT', APP_DEFAULTS.twoFactor.recoveryCodesCount),
        totpDigits: parseEnvInt('TWO_FACTOR_TOTP_DIGITS', APP_DEFAULTS.twoFactor.totpDigits),
        totpPeriodSeconds: parseEnvInt('TWO_FACTOR_TOTP_PERIOD_SECONDS', APP_DEFAULTS.twoFactor.totpPeriodSeconds),
        totpWindow: parseEnvInt('TWO_FACTOR_TOTP_WINDOW', APP_DEFAULTS.twoFactor.totpWindow),
    },
    mail: {
        driver: process.env.MAIL_DRIVER ?? APP_DEFAULTS.mail.driver,
        host: process.env.MAIL_HOST ?? APP_DEFAULTS.mail.host,
        port: parseEnvInt('MAIL_PORT', APP_DEFAULTS.mail.port),
        secure: process.env.MAIL_SECURE === 'true',
        user: process.env.MAIL_USER ?? APP_DEFAULTS.mail.user,
        password: process.env.MAIL_PASSWORD ?? APP_DEFAULTS.mail.password,
        from: process.env.MAIL_FROM!,
        webUrl: process.env.APP_WEB_URL!,
    },
    encryption: {
        key: process.env.ENCRYPTION_KEY!,
    },
    documents: {
        storageDir: process.env.DOCUMENTS_STORAGE_DIR ?? APP_DEFAULTS.documents.storageDir,
        maxFileSizeMb: parseEnvInt('DOCUMENTS_MAX_FILE_SIZE_MB', APP_DEFAULTS.documents.maxFileSizeMb),
        allowedMimeTypes: (process.env.DOCUMENTS_ALLOWED_MIME_TYPES ?? APP_DEFAULTS.documents.allowedMimeTypes)
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean),
    },
    port: parseEnvInt('PORT', APP_DEFAULTS.port),
    nodeEnv: process.env.NODE_ENV ?? APP_DEFAULTS.nodeEnv,
}));
