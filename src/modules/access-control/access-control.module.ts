import { Module } from '@nestjs/common';
import { AccessControlRepository } from '@/modules/access-control/repositories/access-control.repository';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';

@Module({
    providers: [AccessControlRepository, AccessControlService],
    exports: [AccessControlService],
})
export class AccessControlModule {}
