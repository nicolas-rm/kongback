import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import appConfig from '@/configurations/app.config';

export type AppConfig = ConfigType<typeof appConfig>;

@Injectable()
export class AppConfigService {
    constructor(@Inject(appConfig.KEY) private readonly config: AppConfig) {}

    get name() {
        return this.config.name;
    }

    get webUrl() {
        return this.config.webUrl;
    }

    get database() {
        return this.config.database;
    }

    get jwt() {
        return this.config.jwt;
    }

    get session() {
        return this.config.session;
    }

    get twoFactor() {
        return this.config.twoFactor;
    }

    get mail() {
        return this.config.mail;
    }

    get encryption() {
        return this.config.encryption;
    }

    get documents() {
        return this.config.documents;
    }

    get cardcloud() {
        return this.config.cardcloud;
    }

    get security() {
        return this.config.security;
    }

    get port() {
        return this.config.port;
    }

    get nodeEnv() {
        return this.config.nodeEnv;
    }
}
