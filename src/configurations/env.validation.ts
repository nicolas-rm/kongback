import { z } from 'zod';

export const envSchema = z.object({
    DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL valida'),
    DIRECT_URL: z.string().url('DIRECT_URL debe ser una URL valida'),

    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    APP_NAME: z.string().min(1).default('Kong'),
    APP_WEB_URL: z.string().url('APP_WEB_URL debe ser una URL valida'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(60),
    SESSION_TOTAL_MINUTES: z.coerce
        .number()
        .int()
        .positive()
        .default(7 * 24 * 60),
    SESSION_TOUCH_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
    LOGIN_LOCK_DURATION_MINUTES: z.coerce.number().int().positive().default(15),
    LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(60),
    EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().positive().default(60),
    ORGANIZATION_INVITATION_TTL_HOURS: z.coerce.number().int().positive().default(72),

    TWO_FACTOR_ISSUER: z.string().min(1).default('Kong'),
    TWO_FACTOR_SETUP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
    TWO_FACTOR_SETUP_QR_ROTATE_SECONDS: z.coerce.number().int().positive().default(120),
    TWO_FACTOR_LOGIN_CHALLENGE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
    TWO_FACTOR_LOGIN_CHALLENGE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    TWO_FACTOR_RECOVERY_CODES_COUNT: z.coerce.number().int().positive().default(8),
    TWO_FACTOR_TOTP_DIGITS: z.coerce.number().int().min(6).max(8).default(6),
    TWO_FACTOR_TOTP_PERIOD_SECONDS: z.coerce.number().int().positive().default(30),
    TWO_FACTOR_TOTP_WINDOW: z.coerce.number().int().min(0).max(5).default(1),

    MAIL_DRIVER: z.enum(['smtp', 'console', 'disabled']).default('smtp'),
    MAIL_HOST: z.string().default('localhost'),
    MAIL_PORT: z.coerce.number().int().positive().default(587),
    MAIL_SECURE: z
        .string()
        .optional()
        .transform((value) => value === 'true'),
    MAIL_USER: z.string().default(''),
    MAIL_PASSWORD: z.string().default(''),
    MAIL_FROM: z.string().min(1, 'MAIL_FROM es requerido'),

    ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY debe tener exactamente 64 caracteres hexadecimales'),

    DOCUMENTS_STORAGE_DIR: z.string().default('uploads/documents'),
    DOCUMENTS_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(20),
    DOCUMENTS_ALLOWED_MIME_TYPES: z.string().default('application/pdf,image/jpeg,image/png,image/webp,text/plain'),
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
