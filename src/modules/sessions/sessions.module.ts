import { Module } from '@nestjs/common';
import { SessionsRepository } from '@/modules/sessions/repositories/sessions.repository';
import { SessionsService } from '@/modules/sessions/services/sessions.service';

@Module({
    providers: [SessionsRepository, SessionsService],
    exports: [SessionsService],
})
export class SessionsModule {}
