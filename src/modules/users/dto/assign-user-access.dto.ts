import { ValidatorString, ValidatorUUID } from '@/decorators';

export class AssignUserAccessDto {
    @ValidatorUUID()
    roleId!: string;

    @ValidatorUUID({ optional: true, emptyTo: 'null' })
    organizationId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    scopeKey?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    scopeId?: string | null;
}
