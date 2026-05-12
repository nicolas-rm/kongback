import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/decorators/public.decorator';

type RequestConfigOptions = {
    statusCode?: HttpStatus | number;
    isPublic?: boolean;
    throttle?: boolean;
};

export function RequestConfig(options: RequestConfigOptions = {}) {
    const { statusCode = HttpStatus.OK, isPublic = false, throttle = false } = options;
    const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [HttpCode(statusCode)];

    if (isPublic) decorators.push(Public());
    if (throttle) decorators.push(Throttle({ default: { limit: 5, ttl: 60_000 } }));

    return applyDecorators(...decorators);
}
