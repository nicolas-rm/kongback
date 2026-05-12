import { AccessControlModule } from '@/modules/access-control/access-control.module';
import { AuthenticationModule } from '@/modules/authentication/authentication.module';
import { DocumentsModule } from '@/modules/documents/documents.module';
import { HealthModule } from '@/modules/health/health.module';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { OrganizationsModule } from '@/modules/organizations/organizations.module';
import { SchedulerModule } from '@/modules/scheduler/scheduler.module';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { SettingsModule } from '@/modules/settings/settings.module';
import { UsersModule } from '@/modules/users/users.module';

export const APP_MODULES = [
    HealthModule,
    AuthenticationModule,
    UsersModule,
    AccessControlModule,
    OrganizationsModule,
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
    DocumentsModule,
    HealthModule,
    IntegrationsModule,
    NotificationsModule,
    OrganizationsModule,
    SchedulerModule,
    SessionsModule,
    SettingsModule,
    UsersModule,
};
