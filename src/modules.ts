import { AccessControlModule } from '@/modules/access-control/access-control.module';
import { AuthenticationModule } from '@/modules/authentication/authentication.module';
import { DocumentsModule } from '@/modules/documents/documents.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { OrganizationsModule } from '@/modules/organizations/organizations.module';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { SettingsModule } from '@/modules/settings/settings.module';
import { UsersModule } from '@/modules/users/users.module';

export const APP_MODULES = [AuthenticationModule, UsersModule, AccessControlModule, OrganizationsModule, SessionsModule, DocumentsModule, NotificationsModule, SettingsModule];

export { AccessControlModule, AuthenticationModule, DocumentsModule, NotificationsModule, OrganizationsModule, SessionsModule, SettingsModule, UsersModule };
