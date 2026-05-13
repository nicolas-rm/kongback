import type { ArgumentsHost } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import type { I18nKey } from '@/i18n/i18n-keys';

export function translateI18n(host: ArgumentsHost, key: I18nKey, fallback: string, args?: Record<string, unknown>): string {
    const i18n = I18nContext.current(host) ?? I18nContext.current();
    const translated = i18n?.t(key, { args });
    return translated && translated !== key ? translated : fallback;
}
