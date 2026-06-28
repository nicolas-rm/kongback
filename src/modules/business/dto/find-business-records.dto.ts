import { CardAssignmentMode, Status } from '@prisma/client';
import { ValidatorEnum, ValidatorUUID } from '@/decorators';
import { PaginationDto } from '@/utilities/pagination/pagination.dto';

export class FindStatusRecordsDto extends PaginationDto {
    @ValidatorEnum(Status, { optional: true })
    status?: Status;
}

export class FindSubCompaniesDto extends FindStatusRecordsDto {
    @ValidatorUUID({ optional: true })
    companyId?: string;
}

export class FindDriversDto extends FindStatusRecordsDto {
    @ValidatorUUID({ optional: true })
    subCompanyId?: string;

    @ValidatorUUID({ optional: true })
    userId?: string;
}

export class FindVehiclesDto extends FindStatusRecordsDto {
    @ValidatorUUID({ optional: true })
    subCompanyId?: string;

    @ValidatorUUID({ optional: true })
    fuelId?: string;

    @ValidatorUUID({ optional: true })
    driverId?: string;
}

export class FindCardsDto extends FindStatusRecordsDto {
    @ValidatorUUID({ optional: true })
    subCompanyId?: string;

    @ValidatorUUID({ optional: true })
    vehicleId?: string;

    @ValidatorUUID({ optional: true })
    driverId?: string;

    @ValidatorUUID({ optional: true })
    fuelId?: string;

    @ValidatorEnum(CardAssignmentMode, { optional: true })
    assignmentMode?: CardAssignmentMode;
}

export class FindStationsDto extends FindStatusRecordsDto {
    @ValidatorUUID({ optional: true })
    subCompanyId?: string;
}

export class FindStationFuelsDto extends FindStatusRecordsDto {
    @ValidatorUUID({ optional: true })
    stationId?: string;

    @ValidatorUUID({ optional: true })
    fuelId?: string;
}

export class FindCardcloudCardStockDto extends FindStatusRecordsDto {
    @ValidatorUUID({ optional: true })
    assignedCardId?: string;
}
