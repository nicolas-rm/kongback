import { AccessControlModule } from '@/modules/access-control/access-control.module';
import { AuthenticationModule } from '@/modules/authentication/authentication.module';
import { BusinessModule } from '@/modules/business/business.module';
import { DocumentsModule } from '@/modules/documents/documents.module';
import { HealthModule } from '@/modules/health/health.module';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { SchedulerModule } from '@/modules/scheduler/scheduler.module';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { SettingsModule } from '@/modules/settings/settings.module';
import { UsersModule } from '@/modules/users/users.module';

export const APP_MODULES = [
    HealthModule,
    AuthenticationModule,
    UsersModule,
    AccessControlModule,
    BusinessModule,
    SessionsModule,
    DocumentsModule,
    NotificationsModule,
    SettingsModule,
    IntegrationsModule,
    SchedulerModule,
];

export {
    AccessControlModule,
    AuthenticationModule,
    BusinessModule,
    DocumentsModule,
    HealthModule,
    IntegrationsModule,
    NotificationsModule,
    SchedulerModule,
    SessionsModule,
    SettingsModule,
    UsersModule,
};
