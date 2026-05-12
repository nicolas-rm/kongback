import { Injectable } from '@nestjs/common';
import { SessionsRepository } from '@/modules/sessions/repositories/sessions.repository';

@Injectable()
export class SessionsService {
    constructor(private readonly sessionsRepository: SessionsRepository) {}
}
