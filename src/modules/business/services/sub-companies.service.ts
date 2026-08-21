import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import ExcelJS from 'exceljs';
import { ERROR_CODES } from '@/errors/error-codes';
import { I18N_KEYS, I18nHttpException } from '@/i18n';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { hasCompanyWideScope, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { invalidRelation, notFound, textSearch, toAddressData } from '@/modules/business/business.helpers';
import { CreateSubCompanyDto, FindSubCompaniesDto, UpdateSubCompanyDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { SubCompaniesRepository } from '@/modules/business/repositories/sub-companies.repository';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';

type ExcelCellValue = string | number;

type ExcelDownload = {
    filename: string;
    mimeType: string;
    buffer: Buffer;
};

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class SubCompaniesService {
    private readonly logger = new Logger(SubCompaniesService.name);

    constructor(
        private readonly repository: SubCompaniesRepository,
        private readonly relations: BusinessRelationsRepository,
        private readonly cardcloud: CardcloudService
    ) {}

    async create(dto: CreateSubCompanyDto, scope?: CompanyScope) {
        if (!hasCompanyWideScope(scope)) throw invalidRelation();
        const company = await this.relations.findActiveCompany(dto.companyId, scope);
        if (!company) throw invalidRelation();

        if (await this.repository.existsByCompanyKey(dto.companyId, dto.key, scope)) {
            throw new I18nHttpException(HttpStatus.CONFLICT, I18N_KEYS.errors.business.subCompanyKeyExists, 'La clave de subcompania ya existe para esta compania.', {
                code: ERROR_CODES.UNIQUE_CONSTRAINT,
            });
        }

        const cardcloudSubaccountId = await this.createCardcloudSubaccount(company.key, dto.key, dto.name);

        try {
            return await this.repository.create(
                {
                    companyId: dto.companyId,
                    key: dto.key,
                    cardcloudSubaccountId,
                    name: dto.name,
                    status: dto.status ?? Status.active,
                    isDefault: dto.isDefault ?? false,
                },
                toAddressData(dto.address)
            );
        } catch (error) {
            this.logger.error(`No se pudo crear SubCompany local despues de crear subcuenta Cardcloud ${cardcloudSubaccountId}`, error instanceof Error ? error.stack : undefined);
            throw error;
        }
    }

    private async createCardcloudSubaccount(companyKey: string, subCompanyKey: string, name: string): Promise<string> {
        return this.cardcloud.createSubaccountAndResolveId({
            ExternalId: this.buildCardcloudExternalId(companyKey, subCompanyKey),
            Description: name,
        });
    }

    private buildCardcloudExternalId(companyKey: string, subCompanyKey: string): string {
        return `${companyKey}__${subCompanyKey}`;
    }

    async findAll(dto: FindSubCompaniesDto, scope?: CompanyScope) {
        const where: Prisma.SubCompanyWhereInput = {
            AND: [{ ...(dto.companyId ? { companyId: dto.companyId } : {}) }, subCompanyScopeWhere(scope), { ...(dto.status ? { status: dto.status } : {}) }],
            ...(dto.search ? { OR: textSearch<Prisma.SubCompanyWhereInput>(dto.search, ['key', 'cardcloudSubaccountId', 'name']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string, scope?: CompanyScope) {
        const subCompany = await this.repository.findById(id, scope);
        if (!subCompany) throw notFound();
        return subCompany;
    }

    async downloadDrivers(id: string, scope?: CompanyScope): Promise<ExcelDownload> {
        const subCompany = await this.repository.findExportTargetById(id, scope);
        if (!subCompany) throw notFound();

        const drivers = await this.repository.findDriversForExport(id, scope);
        const headers = ['ID', 'Nombre', 'Referencia externa', 'Estado', 'Vehículos asignados', 'Tarjetas asignadas'];
        const rows = drivers.map<ExcelCellValue[]>((driver) => [
            driver.id,
            driver.name,
            this.valueOrDash(driver.externalReference),
            this.mapStatus(driver.status),
            this.joinValues(driver.vehicles.map((vehicle) => this.formatVehicleLabel(vehicle))),
            this.joinValues(driver.vehicles.map((vehicle) => this.formatCardLabel(vehicle.card)).filter((card): card is string => Boolean(card))),
        ]);

        return this.buildWorkbook(subCompany.key, 'conductores', 'Conductores', headers, rows);
    }

    async downloadVehicles(id: string, scope?: CompanyScope): Promise<ExcelDownload> {
        const subCompany = await this.repository.findExportTargetById(id, scope);
        if (!subCompany) throw notFound();

        const vehicles = await this.repository.findVehiclesForExport(id, scope);
        const headers = ['ID', 'Placas', 'Número económico', 'Modelo', 'Año', 'Combustible', 'Control de odómetro', 'Odómetro inicial', 'Estado', 'Conductor asignado', 'Tarjeta asignada'];
        const rows = vehicles.map<ExcelCellValue[]>((vehicle) => [
            vehicle.id,
            vehicle.plates,
            this.valueOrDash(vehicle.economicNumber),
            this.valueOrDash(vehicle.model),
            this.valueOrDash(vehicle.year),
            this.formatFuel(vehicle.fuel),
            this.formatBoolean(vehicle.odometerControl),
            this.valueOrDash(vehicle.odometerInitial),
            this.mapStatus(vehicle.status),
            this.valueOrDash(this.formatDriverLabel(vehicle.driver)),
            this.valueOrDash(this.formatCardLabel(vehicle.card)),
        ]);

        return this.buildWorkbook(subCompany.key, 'vehiculos', 'Vehiculos', headers, rows);
    }

    async downloadCards(id: string, scope?: CompanyScope): Promise<ExcelDownload> {
        const subCompany = await this.repository.findExportTargetById(id, scope);
        if (!subCompany) throw notFound();

        const cards = await this.repository.findCardsForExport(id, scope);
        const headers = ['ID', 'External ID', 'Client ID', 'PAN enmascarado', 'Estado local', 'Estado Cardcloud', 'Modo de asignación', 'Vehículo', 'Combustible de diseño', 'Asignada el'];
        const rows = cards.map<ExcelCellValue[]>((card) => [
            card.id,
            this.valueOrDash(card.externalId),
            this.valueOrDash(card.stock?.clientId),
            this.valueOrDash(card.stock?.maskedPan),
            this.mapStatus(card.status),
            this.valueOrDash(card.stock?.providerStatus),
            this.mapAssignmentMode(card.assignmentMode),
            this.valueOrDash(this.formatVehicleLabel(card.vehicle)),
            this.formatFuel(card.designFuel),
            this.formatDate(card.assignedAt),
        ]);

        return this.buildWorkbook(subCompany.key, 'tarjetas', 'Tarjetas', headers, rows);
    }

    async update(id: string, dto: UpdateSubCompanyDto, scope?: CompanyScope) {
        const subCompany = await this.repository.update(
            id,
            {
                name: dto.name,
                status: dto.status,
                isDefault: dto.isDefault,
            },
            toAddressData(dto.address),
            scope
        );
        if (!subCompany) throw notFound();
        return subCompany;
    }

    async deactivate(id: string, scope?: CompanyScope) {
        const subCompany = await this.repository.deactivate(id, scope);
        if (!subCompany) throw notFound();
        return { id: subCompany.id, status: subCompany.status };
    }

    private async buildWorkbook(subCompanyKey: string, suffix: string, sheetName: string, headers: string[], rows: ExcelCellValue[][]): Promise<ExcelDownload> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);
        worksheet.addRow(headers);
        rows.forEach((row) => worksheet.addRow(row));

        worksheet.getRow(1).font = { bold: true };
        const sheetRows = [headers, ...rows];
        worksheet.columns.forEach((column, index) => {
            const width = sheetRows.reduce((max, row) => Math.max(max, String(row[index] ?? '').length + 2), 14);
            column.width = Math.min(width, 42);
        });

        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        return {
            filename: `subempresa-${this.sanitizeFilenamePart(subCompanyKey)}-${suffix}.xlsx`,
            mimeType: EXCEL_MIME_TYPE,
            buffer,
        };
    }

    private valueOrDash(value: string | number | boolean | null | undefined): string {
        if (value === null || value === undefined || value === '') return '-';
        return String(value);
    }

    private joinValues(values: Array<string | null | undefined>): string {
        const clean = values.filter((value): value is string => Boolean(value));
        return clean.length ? clean.join(', ') : '-';
    }

    private mapStatus(status: Status): string {
        return status === Status.active ? 'Activo' : 'Inactivo';
    }

    private mapAssignmentMode(mode: string): string {
        if (mode === 'vehicle') return 'Vehículo';
        return 'Sin asignar';
    }

    private formatBoolean(value: boolean): string {
        return value ? 'Sí' : 'No';
    }

    private formatFuel(fuel: { code: string; name: string } | null | undefined): string {
        if (!fuel) return '-';
        return `${fuel.name} (${fuel.code})`;
    }

    private formatDriverLabel(driver: { name: string; externalReference: string | null } | null | undefined): string | null {
        if (!driver) return null;
        return [driver.name, driver.externalReference].filter(Boolean).join(' - ');
    }

    private formatVehicleLabel(vehicle: { plates: string; economicNumber: string | null; model: string | null } | null | undefined): string | null {
        if (!vehicle) return null;
        return [vehicle.plates, vehicle.economicNumber, vehicle.model].filter(Boolean).join(' - ');
    }

    private formatCardLabel(card: { externalId: string | null; stock: { clientId: string | null; maskedPan: string | null } | null } | null | undefined): string | null {
        if (!card) return null;
        return card.stock?.clientId ?? card.stock?.maskedPan ?? card.externalId;
    }

    private formatDate(value: Date | null | undefined): string {
        if (!value) return '-';
        return value.toISOString();
    }

    private sanitizeFilenamePart(value: string): string {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
    }
}
