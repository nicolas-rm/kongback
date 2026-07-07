import { Module } from '@nestjs/common';
import { AccessControlModule } from '@/modules/access-control/access-control.module';
import { CardcloudCardStockController } from '@/modules/business/cardcloud-card-stock.controller';
import { CardsController } from '@/modules/business/cards.controller';
import { CompaniesController } from '@/modules/business/companies.controller';
import { DriversController } from '@/modules/business/drivers.controller';
import { FuelsController } from '@/modules/business/fuels.controller';
import { BusinessAddressRepository } from '@/modules/business/repositories/business-address.repository';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { CardcloudCardStockRepository } from '@/modules/business/repositories/cardcloud-card-stock.repository';
import { CardsRepository } from '@/modules/business/repositories/cards.repository';
import { CompaniesRepository } from '@/modules/business/repositories/companies.repository';
import { DriversRepository } from '@/modules/business/repositories/drivers.repository';
import { FuelsRepository } from '@/modules/business/repositories/fuels.repository';
import { StationFuelsRepository } from '@/modules/business/repositories/station-fuels.repository';
import { StationsRepository } from '@/modules/business/repositories/stations.repository';
import { SubCompaniesRepository } from '@/modules/business/repositories/sub-companies.repository';
import { VehiclesRepository } from '@/modules/business/repositories/vehicles.repository';
import { CardcloudCardStockService } from '@/modules/business/services/cardcloud-card-stock.service';
import { CardsService } from '@/modules/business/services/cards.service';
import { CompaniesService } from '@/modules/business/services/companies.service';
import { DriversService } from '@/modules/business/services/drivers.service';
import { FuelsService } from '@/modules/business/services/fuels.service';
import { StationFuelsService } from '@/modules/business/services/station-fuels.service';
import { StationsService } from '@/modules/business/services/stations.service';
import { SubCompaniesService } from '@/modules/business/services/sub-companies.service';
import { VehiclesService } from '@/modules/business/services/vehicles.service';
import { StationFuelsController } from '@/modules/business/station-fuels.controller';
import { StationsController } from '@/modules/business/stations.controller';
import { SubCompaniesController } from '@/modules/business/sub-companies.controller';
import { VehiclesController } from '@/modules/business/vehicles.controller';

@Module({
    imports: [AccessControlModule],
    controllers: [
        CompaniesController,
        SubCompaniesController,
        DriversController,
        FuelsController,
        VehiclesController,
        CardsController,
        StationsController,
        StationFuelsController,
        CardcloudCardStockController,
    ],
    providers: [
        BusinessAddressRepository,
        BusinessRelationsRepository,
        CompaniesRepository,
        SubCompaniesRepository,
        DriversRepository,
        FuelsRepository,
        VehiclesRepository,
        CardsRepository,
        StationsRepository,
        StationFuelsRepository,
        CardcloudCardStockRepository,
        CompaniesService,
        SubCompaniesService,
        DriversService,
        FuelsService,
        VehiclesService,
        CardsService,
        StationsService,
        StationFuelsService,
        CardcloudCardStockService,
    ],
    exports: [CompaniesService, SubCompaniesService, DriversService, FuelsService, VehiclesService, CardsService, StationsService, StationFuelsService, CardcloudCardStockService],
})
export class BusinessModule {}
