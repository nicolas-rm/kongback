import { ValidatorString } from '@/decorators';

export class CreatePermissionDto {
    @ValidatorString({ toLowerCase: true })
    code!: string;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    name?: string | null;

    @ValidatorString({ optional: true, emptyTo: 'null' })
    description?: string | null;
}
