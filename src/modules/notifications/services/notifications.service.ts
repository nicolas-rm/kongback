import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsRepository } from '@/modules/notifications/repositories/notifications.repository';

@Injectable()
export class NotificationsService {
    constructor(private readonly repository: NotificationsRepository) {}

    createForUser(userId: string, data: { title: string; message: string; detail?: string | null; type?: NotificationType; link?: string | null }) {
        return this.repository.createForUser(userId, data);
    }

    countUnreadForUser(userId: string): Promise<number> {
        return this.repository.countUnreadForUser(userId);
    }
}
