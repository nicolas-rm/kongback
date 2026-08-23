import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@/configurations/app-config.service';
import { I18N_KEYS, I18nBadRequestException } from '@/i18n';
import { AuditService } from '@/modules/audit/audit.service';
import { HttpClientService } from '@/modules/integrations/http-client.service';

export type CardcloudQueryParams = Record<string, string | number | boolean | null | undefined>;

interface CardcloudTokenCache {
    token: string;
    expiresAt: number;
    expiresIn: number;
}

interface CardcloudLoginResponse {
    access_token: string;
    expires_in: number;
}

@Injectable()
export class CardcloudExternalService {
    private tokenCache: CardcloudTokenCache | null = null;

    constructor(
        private readonly http: HttpClientService,
        private readonly config: AppConfigService,
        private readonly audit: AuditService
    ) {}

    async get<T>(path: string, params?: CardcloudQueryParams): Promise<T> {
        const token = await this.getToken();
        return this.executeExternal<T>('GET', path, () =>
            this.http.get<T>(this.url(path), {
                headers: { Authorization: `Bearer ${token}` },
                params: this.compactParams(params),
            })
        );
    }

    async post<T>(path: string, body?: unknown): Promise<T> {
        const token = await this.getToken();
        return this.executeExternal<T>('POST', path, () =>
            this.http.post<T>(this.url(path), body, {
                headers: { Authorization: `Bearer ${token}` },
            })
        );
    }

    async patch<T>(path: string, body?: unknown): Promise<T> {
        const token = await this.getToken();
        return this.executeExternal<T>('PATCH', path, () =>
            this.http.patch<T>(this.url(path), body, {
                headers: { Authorization: `Bearer ${token}` },
            })
        );
    }

    private async getToken(): Promise<string> {
        if (!this.tokenCache || Date.now() >= this.tokenCache.expiresAt) {
            return this.authenticate();
        }

        if (this.isTokenAboutToExpire()) {
            return this.refreshOrAuthenticate();
        }

        return this.tokenCache.token;
    }

    private async authenticate(): Promise<string> {
        const { username, password } = this.config.cardcloud;
        if (!username || !password) {
            throw new I18nBadRequestException(I18N_KEYS.errors.validation.invalidData, 'No pudimos conectar con el servicio externo. Intenta mas tarde.');
        }

        const response = await this.executeExternal<CardcloudLoginResponse>('POST', '/auth/login', () =>
            this.http.post<CardcloudLoginResponse>(this.url('/auth/login'), {
                email: username,
                password,
            })
        );

        return this.saveToken(response);
    }

    private async refreshOrAuthenticate(): Promise<string> {
        if (!this.tokenCache) return this.authenticate();

        const token = this.tokenCache.token;
        try {
            const response = await this.executeExternal<CardcloudLoginResponse>('POST', '/auth/refresh', () =>
                this.http.post<CardcloudLoginResponse>(this.url('/auth/refresh'), undefined, {
                    headers: { Authorization: `Bearer ${token}` },
                })
            );
            return this.saveToken(response);
        } catch {
            this.tokenCache = null;
            return this.authenticate();
        }
    }

    private saveToken(response: CardcloudLoginResponse): string {
        const expiresIn = response.expires_in;
        this.tokenCache = {
            token: response.access_token,
            expiresIn,
            expiresAt: Date.now() + expiresIn * 1000,
        };
        return this.tokenCache.token;
    }

    private isTokenAboutToExpire(): boolean {
        if (!this.tokenCache) return true;
        const refreshBufferMs = Math.max(30_000, (this.tokenCache.expiresIn / 30) * 1000);
        return Date.now() >= this.tokenCache.expiresAt - refreshBufferMs;
    }

    private url(path: string): string {
        const baseUrl = this.config.cardcloud.baseUrl.replace(/\/+$/, '');
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${normalizedPath}`;
    }

    private compactParams(params?: CardcloudQueryParams): CardcloudQueryParams | undefined {
        if (!params) return undefined;
        return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
    }

    private async executeExternal<T>(method: string, path: string, operation: () => Promise<T>): Promise<T> {
        try {
            const result = await operation();
            void this.audit.recordCardcloud({
                action: 'cardcloud_external_request',
                result: 'success',
                externalPath: path,
                metadata: { method },
            });
            return result;
        } catch (error) {
            void this.audit.recordCardcloud({
                action: 'cardcloud_external_request',
                result: 'failure',
                statusCode: this.resolveExternalStatus(error),
                externalPath: path,
                reason: error instanceof Error ? error.message : 'cardcloud_external_error',
                metadata: { method },
            });
            throw error;
        }
    }

    private resolveExternalStatus(error: unknown): number | null {
        const response = (error as { response?: { status?: unknown } } | null)?.response;
        return typeof response?.status === 'number' ? response.status : null;
    }
}
