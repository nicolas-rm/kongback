import { Controller, Get } from '@nestjs/common';
import { Public } from '@/decorators';
import { HealthService } from '@/modules/health/health.service';

@Controller('health')
@Public()
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get()
    check() {
        return this.healthService.check();
    }
}
