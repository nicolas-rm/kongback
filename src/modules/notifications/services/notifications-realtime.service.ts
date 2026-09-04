import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import type { SerializableNotificationData } from '@/modules/notifications/services/notifications-serializer.service';

export type RealtimeNotification = SerializableNotificationData & { userId: string };
export type RealtimeReadNotification = Pick<RealtimeNotification, 'id' | 'userId' | 'readAt'>;

export type RealtimeNotificationsReadAll = {
    userId: string;
    updatedCount: number;
    readAt: Date;
};

@Injectable()
export class NotificationsRealtimeService {
    private readonly createdSubject = new Subject<RealtimeNotification>();
    private readonly readSubject = new Subject<RealtimeReadNotification>();
    private readonly readAllSubject = new Subject<RealtimeNotificationsReadAll>();

    readonly created$: Observable<RealtimeNotification> = this.createdSubject.asObservable();
    readonly read$: Observable<RealtimeReadNotification> = this.readSubject.asObservable();
    readonly readAll$: Observable<RealtimeNotificationsReadAll> = this.readAllSubject.asObservable();

    notifyCreated(notification: RealtimeNotification): void {
        this.createdSubject.next(notification);
    }

    notifyRead(notification: RealtimeReadNotification): void {
        this.readSubject.next(notification);
    }

    notifyReadAll(event: RealtimeNotificationsReadAll): void {
        this.readAllSubject.next(event);
    }
}
