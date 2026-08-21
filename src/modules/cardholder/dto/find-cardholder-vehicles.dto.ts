import { ValidatorBoolean } from '@/decorators';

export class FindCardholderVehiclesDto {
    @ValidatorBoolean({ optional: true })
    active?: boolean;
}
