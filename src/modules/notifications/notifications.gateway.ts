import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { I18nService } from 'nestjs-i18n';
import type { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import { I18N_KEYS } from '@/i18n';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsSerializerService, SerializableNotificationData } from '@/modules/notifications/services/notifications-serializer.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { NotificationsRealtimeService } from '@/modules/notifications/services/notifications-realtime.service';
import { NotificationsSocketAuthenticationService } from '@/modules/notifications/notifications-socket-authentication.service';

type GatewayNotification = SerializableNotificationData & { userId: string };
type GatewayReadNotification = Pick<GatewayNotification, 'id' | 'userId' | 'readAt'>;

@Injectable()
@WebSocketGateway({
    namespace: '/notifications',
    cors: {
        origin: true,
        credentials: true,
    },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy {
    @WebSocketServer()
    server!: Server;

    private readonly userRoomPrefix = 'user:';
    private readonly realtimeSubscriptions = new Subscription();

    constructor(
        private readonly socketAuthenticationService: NotificationsSocketAuthenticationService,
        private readonly serializer: NotificationsSerializerService,
        private readonly notificationsService: NotificationsService,
        private readonly i18n: I18nService,
        private readonly audit: AuditService,
        private readonly realtime: NotificationsRealtimeService
    ) {}

    afterInit(): void {
        this.realtimeSubscriptions.add(this.realtime.created$.subscribe((notification) => void this.emitNotificationCreated(notification).catch(() => null)));
        this.realtimeSubscriptions.add(this.realtime.read$.subscribe((notification) => void this.emitNotificationRead(notification).catch(() => null)));
        this.realtimeSubscriptions.add(
            this.realtime.readAll$.subscribe((event) => void this.emitNotificationsReadAll(event.userId, event.updatedCount, event.readAt).catch(() => null))
        );
    }

    onModuleDestroy(): void {
        this.realtimeSubscriptions.unsubscribe();
    }

    async handleConnection(@ConnectedSocket() client: Socket) {
        try {
            const user = await this.socketAuthenticationService.authenticate(client);
            client.data.userId = user.id;
            client.data.username = user.username;
            await client.join(this.getUserRoom(user.id));
            await this.emitUnreadCount(user.id);
            client.emit('notifications.connected', { userId: user.id, connectedAt: new Date().toISOString() });
            void this.audit.recordSecurity({ action: 'notifications_socket_connected', result: 'success', actorUserId: user.id, metadata: { socketId: client.id } });
        } catch {
            void this.audit.recordSecurity({ action: 'notifications_socket_unauthorized', result: 'denied', statusCode: 401, metadata: { socketId: client.id } });
            client.emit('notifications.error', { message: this.translateSocket(client, I18N_KEYS.socket.unauthorized, 'Tu sesion no es valida. Inicia sesion nuevamente.') });
            client.disconnect(true);
        }
    }

    handleDisconnect(@ConnectedSocket() client: Socket) {
        const userId = typeof client.data.userId === 'string' ? client.data.userId : undefined;
        void this.audit.recordSecurity({ action: 'notifications_socket_disconnected', result: 'success', actorUserId: userId, metadata: { socketId: client.id } });
    }

    async emitNotificationCreated(notification: GatewayNotification): Promise<void> {
        this.server.to(this.getUserRoom(notification.userId)).emit('notifications.new', this.serializer.serialize(notification));
        await this.emitUnreadCount(notification.userId);
    }

    async emitNotificationRead(notification: GatewayReadNotification): Promise<void> {
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

    private translateSocket(client: Socket, key: string, fallback: string): string {
        const lang = this.resolveLanguage(client.handshake.headers['accept-language']);
        const translated = this.i18n.t(key, { lang }) as string;
        return translated && translated !== key ? translated : fallback;
    }

    private resolveLanguage(header: string | string[] | undefined): string {
        const value = Array.isArray(header) ? header[0] : header;
        return value?.split(',')[0]?.trim().split('-')[0] || 'es';
    }
}
