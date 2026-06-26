import { IsUUID } from 'class-validator';
import { ValidatorArray } from '@/decorators';
import { buildI18nValidationMessage, I18N_KEYS } from '@/i18n';

export class AssignRolePermissionsDto {
    @ValidatorArray({ minSize: 0, preserveEmptyArray: true })
    @IsUUID('4', { each: true, message: buildI18nValidationMessage(undefined, I18N_KEYS.validation.uuid) })
    permissionIds!: string[];
}
