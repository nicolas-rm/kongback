import { Module } from '@nestjs/common';
import { SettingsRepository } from '@/modules/settings/repositories/settings.repository';
import { SettingsService } from '@/modules/settings/services/settings.service';

@Module({
    providers: [SettingsRepository, SettingsService],
    exports: [SettingsService],
})
export class SettingsModule {}
