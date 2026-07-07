import { z } from 'zod';
import { APP_DEFAULTS } from '@/configurations/defaults';

export const envSchema = z.object({
    DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL valida'),
    DIRECT_URL: z.string().url('DIRECT_URL debe ser una URL valida'),

    PORT: z.coerce.number().int().positive().default(APP_DEFAULTS.port),
    NODE_ENV: z.enum(['development', 'production', 'test']).default(APP_DEFAULTS.nodeEnv),
    APP_NAME: z.string().min(1).default(APP_DEFAULTS.name),
    APP_WEB_URL: z.string().url('APP_WEB_URL debe ser una URL valida'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
    JWT_ACCESS_EXPIRES_IN: z.string().default(APP_DEFAULTS.jwt.accessExpiresIn),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
    JWT_REFRESH_EXPIRES_IN: z.string().default(APP_DEFAULTS.jwt.refreshExpiresIn),

    SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(APP_DEFAULTS.session.idleTimeoutMinutes),
    SESSION_TOTAL_MINUTES: z.coerce.number().int().positive().default(APP_DEFAULTS.session.totalMinutes),
    SESSION_TOUCH_INTERVAL_SECONDS: z.coerce.number().int().positive().default(APP_DEFAULTS.session.touchIntervalSeconds),
    LOGIN_LOCK_DURATION_MINUTES: z.coerce.number().int().positive().default(APP_DEFAULTS.session.lockDurationMinutes),
    LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(APP_DEFAULTS.session.maxFailedAttempts),
    SESSION_MAX_ACTIVE: z.coerce.number().int().positive().default(APP_DEFAULTS.session.maxActiveSessions),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(APP_DEFAULTS.session.passwordResetTtlMinutes),
    EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().positive().default(APP_DEFAULTS.session.emailVerificationTtlMinutes),

    TWO_FACTOR_ISSUER: z.string().min(1).default(APP_DEFAULTS.name),
    TWO_FACTOR_SETUP_TTL_MINUTES: z.coerce.number().int().positive().default(APP_DEFAULTS.twoFactor.setupTtlMinutes),
    TWO_FACTOR_SETUP_QR_ROTATE_SECONDS: z.coerce.number().int().positive().default(APP_DEFAULTS.twoFactor.setupQrRotateSeconds),
    TWO_FACTOR_LOGIN_CHALLENGE_TTL_MINUTES: z.coerce.number().int().positive().default(APP_DEFAULTS.twoFactor.loginChallengeTtlMinutes),
    TWO_FACTOR_LOGIN_CHALLENGE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(APP_DEFAULTS.twoFactor.loginChallengeMaxAttempts),
    TWO_FACTOR_RECOVERY_CODES_COUNT: z.coerce.number().int().positive().default(APP_DEFAULTS.twoFactor.recoveryCodesCount),
    TWO_FACTOR_TOTP_DIGITS: z.coerce.number().int().min(6).max(8).default(APP_DEFAULTS.twoFactor.totpDigits),
    TWO_FACTOR_TOTP_PERIOD_SECONDS: z.coerce.number().int().positive().default(APP_DEFAULTS.twoFactor.totpPeriodSeconds),
    TWO_FACTOR_TOTP_WINDOW: z.coerce.number().int().min(0).max(5).default(APP_DEFAULTS.twoFactor.totpWindow),

    MAIL_DRIVER: z.enum(['smtp', 'console', 'disabled']).default(APP_DEFAULTS.mail.driver),
    MAIL_HOST: z.string().default(APP_DEFAULTS.mail.host),
    MAIL_PORT: z.coerce.number().int().positive().default(APP_DEFAULTS.mail.port),
    MAIL_SECURE: z
        .string()
        .optional()
        .transform((value) => value === 'true'),
    MAIL_USER: z.string().default(APP_DEFAULTS.mail.user),
    MAIL_PASSWORD: z.string().default(APP_DEFAULTS.mail.password),
    MAIL_FROM: z.string().min(1, 'MAIL_FROM es requerido'),

    ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY debe tener exactamente 64 caracteres hexadecimales'),

    DOCUMENTS_STORAGE_DIR: z.string().default(APP_DEFAULTS.documents.storageDir),
    DOCUMENTS_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(APP_DEFAULTS.documents.maxFileSizeMb),
    DOCUMENTS_ALLOWED_MIME_TYPES: z.string().default(APP_DEFAULTS.documents.allowedMimeTypes),

    SECURITY_ALLOWED_ORIGINS: z.string().default(APP_DEFAULTS.security.allowedOrigins),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>) {
    const parsed = envSchema.safeParse(config);

    if (!parsed.success) {
        const errors = parsed.error.issues.map((error) => `${error.path.join('.')}: ${error.message}`);
        throw new Error(`Validacion de variables de entorno fallo:\n${errors.join('\n')}`);
    }

    return parsed.data;
}
