import { NotificationType } from '@prisma/client';
import { ValidatorEnum, ValidatorString, ValidatorUUID } from '@/decorators';

export class CreateNotificationDto {
    @ValidatorUUID()
    userId!: string;

    @ValidatorString()
    title!: string;

    @ValidatorString()
    message!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    detail?: string | null;

    @ValidatorEnum(NotificationType, { optional: true })
    type?: NotificationType;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    link?: string | null;
}
