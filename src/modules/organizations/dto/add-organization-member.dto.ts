import { ValidatorUUID } from '@/decorators';

export class AddOrganizationMemberDto {
    @ValidatorUUID()
    userId!: string;
}
