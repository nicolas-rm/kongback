import { i18nValidationMessage } from 'nestjs-i18n';
import type { I18nKey } from '@/i18n/i18n-keys';

export function buildI18nValidationMessage(customMessage: string | undefined, key: I18nKey, args?: Record<string, unknown>) {
    return customMessage ?? i18nValidationMessage(key, args);
}
