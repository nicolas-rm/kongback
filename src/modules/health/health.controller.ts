import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/decorators';
import { HealthService } from '@/modules/health/health.service';

@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get()
    check() {
        return this.healthService.check();
    }
}
