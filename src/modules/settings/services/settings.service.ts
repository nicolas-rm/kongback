import { Injectable } from '@nestjs/common';
import { SettingsRepository } from '@/modules/settings/repositories/settings.repository';

@Injectable()
export class SettingsService {
    constructor(private readonly settingsRepository: SettingsRepository) {}
}
