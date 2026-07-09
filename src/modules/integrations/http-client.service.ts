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

    async patch<T>(url: string, data?: unknown, options?: Parameters<HttpService['patch']>[2]): Promise<T> {
        const response = await firstValueFrom(this.httpService.patch<T>(url, data, options));
        return response.data;
    }

    async put<T>(url: string, data?: unknown, options?: Parameters<HttpService['put']>[2]): Promise<T> {
        const response = await firstValueFrom(this.httpService.put<T>(url, data, options));
        return response.data;
    }

    async delete<T>(url: string, options?: Parameters<HttpService['delete']>[1]): Promise<T> {
        const response = await firstValueFrom(this.httpService.delete<T>(url, options));
        return response.data;
    }

    async request<T>(config: Parameters<HttpService['request']>[0]): Promise<T> {
        const response = await firstValueFrom(this.httpService.request<T>(config));
        return response.data;
    }

    async head<T>(url: string, options?: Parameters<HttpService['head']>[1]): Promise<T> {
        const response = await firstValueFrom(this.httpService.head<T>(url, options));
        return response.data;
    }
}
