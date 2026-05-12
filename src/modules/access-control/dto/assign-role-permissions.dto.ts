import { ValidatorArray } from '@/decorators';

export class AssignRolePermissionsDto {
    @ValidatorArray({ minSize: 0, preserveEmptyArray: true })
    permissionIds!: string[];
}
