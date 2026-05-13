import { Injectable } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { NotificationsSerializerService } from '@/modules/notifications/services/notifications-serializer.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { NotificationsSocketAuthenticationService } from '@/modules/notifications/notifications-socket-authentication.service';

@Injectable()
@WebSocketGateway({
    namespace: '/notifications',
    cors: {
        origin: process.env.APP_WEB_URL,
        credentials: true,
    },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private readonly userRoomPrefix = 'user:';

    constructor(
        private readonly socketAuthenticationService: NotificationsSocketAuthenticationService,
        private readonly serializer: NotificationsSerializerService,
        private readonly notificationsService: NotificationsService
    ) {}

    async handleConnection(@ConnectedSocket() client: Socket) {
        try {
            const user = await this.socketAuthenticationService.authenticate(client);
            client.data.userId = user.id;
            client.data.username = user.username;
            await client.join(this.getUserRoom(user.id));
            await this.emitUnreadCount(user.id);
            client.emit('notifications.connected', { userId: user.id, connectedAt: new Date().toISOString() });
        } catch {
            client.emit('notifications.error', { message: 'No autorizado' });
            client.disconnect(true);
        }
    }

    handleDisconnect() {}

    async emitNotificationCreated(notification: Notification): Promise<void> {
        this.server.to(this.getUserRoom(notification.userId)).emit('notifications.new', this.serializer.serialize(notification));
        await this.emitUnreadCount(notification.userId);
    }

    async emitNotificationRead(notification: Notification): Promise<void> {
        this.server.to(this.getUserRoom(notification.userId)).emit('notifications.read', {
            id: notification.id,
            readAt: notification.readAt?.toISOString() ?? null,
        });
        await this.emitUnreadCount(notification.userId);
    }

    async emitNotificationsReadAll(userId: string, updatedCount: number, readAt: Date): Promise<void> {
        this.server.to(this.getUserRoom(userId)).emit('notifications.read_all', {
            updatedCount,
            readAt: readAt.toISOString(),
        });
        await this.emitUnreadCount(userId);
    }

    private async emitUnreadCount(userId: string): Promise<void> {
        const count = await this.notificationsService.countUnreadForUser(userId);
        this.server.to(this.getUserRoom(userId)).emit('notifications.unread_count', { count });
    }

    private getUserRoom(userId: string): string {
        return `${this.userRoomPrefix}${userId}`;
    }
}
