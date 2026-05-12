import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HttpClientService {
    constructor(private readonly httpService: HttpService) {}

    async get<T>(url: string, options?: Parameters<HttpService['get']>[1]): Promise<T> {
        const response = await firstValueFrom(this.httpService.get<T>(url, options));
        return response.data;
    }

    async post<T>(url: string, data?: unknown, options?: Parameters<HttpService['post']>[2]): Promise<T> {
        const response = await firstValueFrom(this.httpService.post<T>(url, data, options));
        return response.data;
    }
}
