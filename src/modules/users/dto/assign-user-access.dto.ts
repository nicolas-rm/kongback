import { ValidatorString } from '@/decorators';

export class AssignUserAccessDto {
    @ValidatorString()
    roleId!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    organizationId?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    scopeKey?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    scopeId?: string | null;
}
