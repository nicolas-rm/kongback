import { Module } from '@nestjs/common';
import { PermissionsController } from '@/modules/access-control/permissions.controller';
import { RolesController } from '@/modules/access-control/roles.controller';
import { AccessControlRepository } from '@/modules/access-control/repositories/access-control.repository';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';

@Module({
    controllers: [RolesController, PermissionsController],
    providers: [AccessControlRepository, AccessControlService],
    exports: [AccessControlService],
})
export class AccessControlModule {}
