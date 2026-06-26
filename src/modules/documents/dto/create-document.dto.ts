import { ValidatorString, ValidatorUUID } from '@/decorators';

export class CreateDocumentDto {
    @ValidatorString()
    title!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    description?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    category?: string | null;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    organizationId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    entityType?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    entityId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    scopeKey?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    scopeId?: string | null;
}
