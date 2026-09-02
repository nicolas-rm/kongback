import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CardAssignmentMode, NotificationType, Prisma, Status } from '@prisma/client';
import ExcelJS from 'exceljs';
import { extname } from 'node:path';
import { createExcelExport, EXCEL_EXPORT_MAX_ROWS, formatStatus, joinValues, valueOrDash } from '@/utilities/export/excel-export';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { scopedSubCompanyIdFilter, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { assertActive, invalidRelation, notFound } from '@/modules/business/business.helpers';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import {
    AssignCardsToSubCompanyExcelDto,
    AssignCardsToSubCompanyDto,
    AssignCardVehicleDto,
    CreateCardDto,
    FindCardsDto,
    FindStatusRecordsDto,
    SyncSubCompanyCardsDto,
    UpdateCardAssignmentDto,
    UpdateCardDto,
    ValidateOwnedCardDto,
} from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { CardsRepository } from '@/modules/business/repositories/cards.repository';
import { VehiclesRepository } from '@/modules/business/repositories/vehicles.repository';
import { CardcloudDateRangeQueryDto } from '@/modules/cardcloud/dto/cardcloud-proxy.dto';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';
import { AuditService } from '@/modules/audit/audit.service';
import type { UploadedFile } from '@/modules/documents/types/uploaded-file.type';

type CardcloudSubaccountCard = {
    card_id?: string | null;
    card_external_id?: string | null;
};

type CardcloudSubaccountCardsRaw = {
    cards?: CardcloudSubaccountCard[];
    total_pages?: string | number | null;
};

type CardRecord = Awaited<ReturnType<CardsRepository['findMany']>>[number];
type SyncExternalCardsResult = Awaited<ReturnType<CardsRepository['syncExternalCardsToSubCompany']>>;
type AssignableStockExcelRecord = Awaited<ReturnType<CardsRepository['findAssignableStockForSubCompanyAssignment']>>[number];
type AssignCardsExcelTemplateResponse = {
    filename: string;
    mimeType: string;
    buffer: Buffer;
};
type AssignCardsExcelRowStatus = 'succeeded' | 'failed' | 'omitted';
type ParsedAssignCardsExcelRow = {
    row: number;
    clientId: string | null;
    externalId: string | null;
    maskedPan: string | null;
    providerStatus: string | null;
    subCompany: string | null;
    description: string | null;
};
type ResolvedAssignCardsExcelRow = ParsedAssignCardsExcelRow & {
    clientId: string;
    externalId: string;
    stockId: string;
};
type AssignCardsExcelResult = ParsedAssignCardsExcelRow & {
    status: AssignCardsExcelRowStatus;
    stockId: string | null;
    cardId: string | null;
    message: string;
};

const ASSIGN_CARDS_EXCEL_FILENAME = 'plantilla-asignacion-tarjetas.xlsx';
const ASSIGN_CARDS_EXCEL_MAX_ITEMS = 100;
const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXCEL_MIME_TYPES = new Set([EXCEL_MIME_TYPE, 'application/octet-stream']);
const CARD_HEADERS = new Set(['card', 'card id', 'card_id', 'cardid', 'tarjeta', 'tarjeta id', 'tarjeta_id', 'externalid', 'external id', 'external_id', 'cardcloud id', 'cardcloud_id']);
const CLIENT_ID_HEADERS = new Set(['clientid', 'client_id', 'client id', 'clienteid', 'cliente_id', 'cliente id']);
const MASKED_PAN_HEADERS = new Set(['maskedpan', 'masked pan', 'masked_pan', 'pan', 'tarjeta enmascarada']);
const PROVIDER_STATUS_HEADERS = new Set(['providerstatus', 'provider status', 'provider_status', 'estado proveedor', 'estado_proveedor']);
const SUB_COMPANY_HEADERS = new Set(['subcompany', 'sub company', 'sub_company', 'subcompania', 'subcompania actual', 'subcompania_actual']);
const DESCRIPTION_HEADERS = new Set(['description', 'descripcion', 'concepto', 'detalle']);

@Injectable()
export class CardsService {
    constructor(
        private readonly repository: CardsRepository,
        private readonly relations: BusinessRelationsRepository,
        private readonly vehicles: VehiclesRepository,
        private readonly cardcloud: CardcloudService,
        private readonly notifications: NotificationsService,
        private readonly audit: AuditService
    ) {}

    async create(dto: CreateCardDto, scope?: CompanyScope) {
        const assignmentMode = dto.vehicleId ? CardAssignmentMode.vehicle : CardAssignmentMode.unassigned;
        await assertActive([
            { ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids, scope) },
            { ids: [dto.vehicleId], count: (ids) => this.relations.countActiveVehicles(ids, scope) },
            { ids: [dto.designFuelId], count: (ids) => this.relations.countActiveFuels(ids) },
        ]);

        if (dto.vehicleId) {
            const vehicle = await this.vehicles.findById(dto.vehicleId, scope);
            if (!vehicle || vehicle.subCompanyId !== dto.subCompanyId) throw invalidRelation();
            if (dto.designFuelId && vehicle.fuelId !== dto.designFuelId) throw invalidRelation();
        }

        const card = await this.repository.create({
            subCompanyId: dto.subCompanyId,
            vehicleId: dto.vehicleId ?? null,
            designFuelId: dto.designFuelId ?? null,
            externalId: dto.externalId ?? null,
            assignmentMode,
            status: dto.status ?? Status.active,
            assignedAt: assignmentMode === CardAssignmentMode.unassigned ? null : (dto.assignedAt ?? new Date()),
        });
        void this.audit.recordCard({ action: 'card_created', resourceType: 'Card', resourceId: card.id, after: this.cardAuditSnapshot(card) });
        return this.mapCard(card);
    }

    async findAll(dto: FindCardsDto, scope?: CompanyScope) {
        const where = this.buildWhere(dto, scope);
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(
            data.map((card) => this.mapCard(card)),
            total,
            dto
        );
    }

    async exportList(dto: FindCardsDto, scope?: CompanyScope) {
        const where = this.buildWhere(dto, scope);
        const cards = await this.repository.findMany(where, 0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordCard({
            action: 'cards_exported',
            resourceType: 'Card',
            metadata: {
                rows: cards.length,
                subCompanyId: dto.subCompanyId,
                vehicleId: dto.vehicleId,
                designFuelId: dto.designFuelId,
                assignmentMode: dto.assignmentMode,
                status: dto.status,
                search: dto.search,
                format: dto.format ?? 'xlsx',
            },
        });

        return createExcelExport(
            'tarjetas.xlsx',
            'Tarjetas',
            [
                { header: 'ID', value: (card) => card.id },
                { header: 'External ID', value: (card) => valueOrDash(card.externalId ?? card.stock?.externalId) },
                { header: 'Client ID', value: (card) => valueOrDash(card.stock?.clientId) },
                { header: 'PAN enmascarado', value: (card) => valueOrDash(this.cardcloud.serializeStockSummary(card.stock)?.maskedPan) },
                { header: 'Subcompania', value: (card) => `${card.subCompany.key} - ${card.subCompany.name}` },
                { header: 'Vehiculo', value: (card) => joinValues([card.vehicle?.plates, card.vehicle?.economicNumber]) },
                { header: 'Combustible de diseno', value: (card) => (card.designFuel ? `${card.designFuel.code} - ${card.designFuel.name}` : '-') },
                { header: 'Modo de asignacion', value: (card) => this.formatAssignmentMode(card.assignmentMode) },
                { header: 'Estado local', value: (card) => formatStatus(card.status) },
                { header: 'Estado Cardcloud', value: (card) => valueOrDash(card.stock?.providerStatus) },
                { header: 'Saldo', value: (card) => valueOrDash(this.cardcloud.serializeStockSummary(card.stock)?.balance) },
                { header: 'Asignada el', value: (card) => valueOrDash(card.assignedAt) },
            ],
            cards,
            dto.format
        );
    }

    async findOne(id: string, scope?: CompanyScope) {
        const card = await this.repository.findById(id, scope);
        if (!card) throw notFound();
        return this.mapCard(card);
    }

    async validateOwnedCard(dto: ValidateOwnedCardDto, scope?: CompanyScope) {
        const candidates = await this.repository.findAssignedStockByClientId(dto.clientId, scope);
        if (candidates.length === 0) throw notFound();
        if (candidates.length > 1) throw new ConflictException('No pudimos identificar una sola tarjeta con esos datos.');

        const stock = candidates[0];
        if (!stock.assignedCard) throw notFound();

        const sensitive = await this.cardcloud.getCardSensitiveData(stock.externalId);
        const panDigits = this.extractPanDigits(sensitive);
        const validated = await this.cardcloud.validateCard({
            card: panDigits.slice(-8),
            pin: dto.nip,
            moye: dto.vigencia.replace(/\D/g, ''),
        });

        const validatedCardId = this.extractValidatedCardId(validated);
        if (!validatedCardId) throw new BadRequestException('No pudimos validar la tarjeta con el proveedor. Intenta nuevamente.');
        if (validatedCardId !== stock.externalId) throw new BadRequestException('Los datos no corresponden a la tarjeta seleccionada.');

        void this.audit.recordCard({
            action: 'card_validated',
            resourceType: 'Card',
            resourceId: stock.assignedCard.id,
            metadata: { clientId: stock.clientId, externalId: stock.externalId },
        });

        return {
            valid: true,
            card: {
                id: stock.assignedCard.id,
                externalId: stock.externalId,
                clientId: stock.clientId,
                maskedPan: stock.maskedPan,
                status: stock.assignedCard.status,
                subCompanyId: stock.assignedCard.subCompanyId,
                vehicleId: stock.assignedCard.vehicleId,
                assignmentMode: stock.assignedCard.assignmentMode,
            },
        };
    }

    async getMovements(id: string, dto: CardcloudDateRangeQueryDto, scope?: CompanyScope) {
        const card = await this.repository.findById(id, scope);
        if (!card) throw notFound();
        if (!card.externalId) throw invalidRelation();

        const movements = await this.cardcloud.getCardMovements(card.externalId, dto);
        void this.audit.recordCard({ action: 'card_movements_consulted', resourceType: 'Card', resourceId: card.id, metadata: { from: dto.from, to: dto.to } });
        return movements;
    }

    async exportMovements(id: string, dto: CardcloudDateRangeQueryDto, scope?: CompanyScope) {
        const card = await this.repository.findById(id, scope);
        if (!card) throw notFound();
        if (!card.externalId) throw invalidRelation();

        const file = await this.cardcloud.exportCardMovements(card.externalId, dto);
        void this.audit.recordCard({
            action: 'card_movements_exported',
            resourceType: 'Card',
            resourceId: card.id,
            metadata: { externalId: card.externalId, from: dto.from, to: dto.to, format: dto.format ?? 'xlsx' },
        });
        return file;
    }

    async findByDesignFuel(designFuelId: string, dto: FindStatusRecordsDto, scope?: CompanyScope) {
        await assertActive([{ ids: [designFuelId], count: (ids) => this.relations.countActiveFuels(ids) }]);

        const where: Prisma.CardWhereInput = {
            subCompany: subCompanyScopeWhere(scope),
            designFuelId,
            status: dto.status,
            ...(dto.search ? { OR: this.cardSearch(dto.search) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(
            data.map((card) => this.mapCard(card)),
            total,
            dto
        );
    }

    async assignCardsToSubCompany(dto: AssignCardsToSubCompanyDto, scope?: CompanyScope) {
        const target = await this.resolveCardcloudTarget(dto.subCompanyId, scope);
        const response = await this.cardcloud.assignCardsBulk({
            subaccount_id: target.cardcloudSubaccountId,
            cards: dto.cards,
        });
        const externalIds = this.resolveCardIdsFromResponse(response, dto.cards);
        const result = await this.repository.syncExternalCardsToSubCompany(target.id, externalIds);

        void this.audit.recordCard({
            action: 'cards_assigned_to_sub_company',
            resourceType: 'SubCompany',
            resourceId: target.id,
            metadata: { cardcloudSubaccountId: target.cardcloudSubaccountId, requested: dto.cards.length, resolved: externalIds.length, result: this.syncResultAuditSummary(result) },
        });

        return {
            subCompanyId: target.id,
            cardcloudSubaccountId: target.cardcloudSubaccountId,
            ...result,
            cards: result.cards.map((card) => this.mapCard(card)),
        };
    }

    async downloadAssignCardsToSubCompanyExcelTemplate(scope?: CompanyScope): Promise<AssignCardsExcelTemplateResponse> {
        const availableStock = await this.repository.findAssignableStockForSubCompanyAssignment(scope);
        const workbook = new ExcelJS.Workbook();
        const templateSheet = workbook.addWorksheet('Asignacion');

        templateSheet.addRow(['clientId', 'maskedPan', 'providerStatus']);
        for (const stock of availableStock) {
            templateSheet.addRow([stock.clientId ?? '', stock.maskedPan ?? '', stock.providerStatus ?? '']);
        }

        const instructionsSheet = workbook.addWorksheet('Instrucciones');
        [
            ['Campo', 'Detalle'],
            ['Hoja a procesar', 'Solo se procesa la primera hoja del archivo.'],
            ['Columnas base', 'clientId, maskedPan, providerStatus.'],
            ['clientId', 'Obligatorio para procesar. El backend usa este valor para resolver la tarjeta disponible en el stock local.'],
            ['maskedPan', 'Referencia informativa de la tarjeta enmascarada. No se usa para procesar.'],
            ['providerStatus', 'Referencia informativa del estado recibido desde Cardcloud. No se usa para procesar.'],
            ['Filas a procesar', 'Elimina del archivo las filas que no quieras asignar; se procesan los clientId que permanezcan en la primera hoja.'],
            ['Duplicados', 'No repitas clientId dentro del mismo archivo.'],
            ['Limite', `Maximo ${ASSIGN_CARDS_EXCEL_MAX_ITEMS} tarjetas procesables por archivo.`],
        ].forEach((row) => instructionsSheet.addRow(row));

        this.autosizeWorksheet(templateSheet);
        this.autosizeWorksheet(instructionsSheet);

        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        void this.audit.recordCard({
            action: 'cards_assign_sub_company_excel_template_downloaded',
            resourceType: 'CardcloudStock',
            metadata: { filename: ASSIGN_CARDS_EXCEL_FILENAME, rows: availableStock.length },
        });

        return {
            filename: ASSIGN_CARDS_EXCEL_FILENAME,
            mimeType: EXCEL_MIME_TYPE,
            buffer,
        };
    }

    async assignCardsToSubCompanyExcel(dto: AssignCardsToSubCompanyExcelDto, file: UploadedFile | undefined, scope?: CompanyScope, actorUserId?: string) {
        this.assertExcelFile(file);

        const target = await this.resolveCardcloudTarget(dto.subCompanyId, scope);
        const parsedRows = await this.parseAssignCardsExcel(file);
        const results: AssignCardsExcelResult[] = [];
        const candidateRows = this.resolveAssignCardsExcelCandidateRows(parsedRows, results);
        const rowsWithoutDuplicates = this.removeDuplicateAssignCardsClientIds(candidateRows, results);
        const preparedRows = this.applyAssignCardsExcelLimit(rowsWithoutDuplicates, results);
        const resolvedRows = await this.resolveAssignCardsExcelRows(preparedRows, results, scope);
        let syncResult: SyncExternalCardsResult | null = null;

        if (resolvedRows.length > 0) {
            const requestedCards = resolvedRows.map((row) => row.externalId);
            const response = await this.cardcloud.assignCardsBulk({
                subaccount_id: target.cardcloudSubaccountId,
                cards: requestedCards,
            });
            const externalIds = this.resolveCardIdsFromResponse(response, requestedCards);
            const resolvedExternalIds = new Set(externalIds);
            syncResult = await this.repository.syncExternalCardsToSubCompany(target.id, externalIds);
            const cardsByExternalId = new Map(syncResult.cards.filter((card) => card.externalId).map((card) => [card.externalId!, card]));

            for (const row of resolvedRows) {
                const cardId = cardsByExternalId.get(row.externalId)?.id ?? null;
                const succeeded = resolvedExternalIds.has(row.externalId);
                results.push(
                    this.assignCardsExcelResult(
                        row,
                        succeeded ? 'succeeded' : 'failed',
                        succeeded ? 'Tarjeta asignada correctamente.' : 'Cardcloud no devolvio confirmacion para esta tarjeta.',
                        cardId,
                        row.stockId
                    )
                );
            }
        }

        const orderedResults = results.sort((a, b) => a.row - b.row);
        const summary = {
            totalRows: parsedRows.length,
            requested: candidateRows.length,
            unique: rowsWithoutDuplicates.length,
            prepared: resolvedRows.length,
            succeeded: orderedResults.filter((result) => result.status === 'succeeded').length,
            failed: orderedResults.filter((result) => result.status === 'failed').length,
            omitted: orderedResults.filter((result) => result.status === 'omitted').length,
            created: syncResult?.created ?? 0,
            updated: syncResult?.updated ?? 0,
            unchanged: syncResult?.unchanged ?? 0,
        };

        if (actorUserId) {
            await this.notifyUser(
                actorUserId,
                summary.failed > 0 ? 'Asignacion masiva procesada con errores' : 'Asignacion masiva procesada',
                `Filas: ${summary.totalRows}. Exitosas: ${summary.succeeded}. Fallidas: ${summary.failed}. Omitidas: ${summary.omitted}.`,
                'Revisa el resultado del procesamiento para validar cada tarjeta.',
                summary.failed > 0 ? NotificationType.warning : NotificationType.success
            );
        }

        void this.audit.recordCard({
            action: 'cards_assigned_to_sub_company_excel_processed',
            resourceType: 'SubCompany',
            resourceId: target.id,
            metadata: {
                cardcloudSubaccountId: target.cardcloudSubaccountId,
                filename: file.originalname,
                size: file.size,
                ...summary,
            },
        });

        return {
            subCompanyId: target.id,
            cardcloudSubaccountId: target.cardcloudSubaccountId,
            results: orderedResults,
            summary,
            cards: (syncResult?.cards ?? []).map((card) => this.mapCard(card)),
        };
    }

    async syncSubCompanyCards(dto: SyncSubCompanyCardsDto, scope?: CompanyScope) {
        const target = await this.resolveCardcloudTarget(dto.subCompanyId, scope);
        const cards = await this.fetchAllSubaccountCards(target.cardcloudSubaccountId);
        const externalIds = cards.map((card) => this.resolveCardExternalId(card)).filter((externalId): externalId is string => Boolean(externalId));
        const result = await this.repository.syncExternalCardsToSubCompany(target.id, externalIds);

        void this.audit.recordCard({
            action: 'sub_company_cards_synced',
            resourceType: 'SubCompany',
            resourceId: target.id,
            metadata: { cardcloudSubaccountId: target.cardcloudSubaccountId, fetched: cards.length, resolved: externalIds.length, result: this.syncResultAuditSummary(result) },
        });

        return {
            subCompanyId: target.id,
            cardcloudSubaccountId: target.cardcloudSubaccountId,
            fetched: cards.length,
            ...result,
            cards: result.cards.map((card) => this.mapCard(card)),
        };
    }

    async update(id: string, dto: UpdateCardDto, scope?: CompanyScope) {
        const current = await this.repository.findById(id, scope);
        if (!current) throw notFound();

        await assertActive([{ ids: [dto.designFuelId], count: (ids) => this.relations.countActiveFuels(ids) }]);

        if (dto.designFuelId && current.vehicleId) {
            const vehicle = await this.vehicles.findById(current.vehicleId, scope);
            if (!vehicle || vehicle.fuelId !== dto.designFuelId) throw invalidRelation();
        }

        const data: Prisma.CardUncheckedUpdateInput = {
            designFuelId: dto.designFuelId,
            externalId: dto.externalId,
            status: dto.status,
        };

        const card = await this.repository.update(id, data, scope);
        if (!card) throw notFound();
        void this.audit.recordCard({ action: 'card_updated', resourceType: 'Card', resourceId: card.id, before: this.cardAuditSnapshot(current), metadata: dto, after: this.cardAuditSnapshot(card) });
        return this.mapCard(card);
    }

    async deactivate(id: string, scope?: CompanyScope) {
        const card = await this.repository.deactivate(id, scope);
        if (!card) throw notFound();
        void this.audit.recordCard({ action: 'card_deactivated', resourceType: 'Card', resourceId: card.id, after: { id: card.id, status: card.status } });
        return { id: card.id, status: card.status };
    }

    async assignVehicle(id: string, dto: AssignCardVehicleDto, scope?: CompanyScope) {
        const current = await this.repository.findById(id, scope);
        if (!current) throw notFound();
        if (current.status !== Status.active) throw invalidRelation();

        await assertActive([{ ids: [dto.vehicleId], count: (ids) => this.relations.countActiveVehicles(ids, scope) }]);

        const vehicle = await this.vehicles.findById(dto.vehicleId, scope);
        if (!vehicle || vehicle.subCompanyId !== current.subCompanyId) throw invalidRelation();
        if (current.designFuelId && vehicle.fuelId !== current.designFuelId) throw invalidRelation();

        const assignedAt = dto.assignedAt ?? current.assignedAt ?? new Date();
        const card = await this.repository.update(
            id,
            {
                vehicleId: dto.vehicleId,
                assignmentMode: CardAssignmentMode.vehicle,
                assignedAt,
            },
            scope
        );
        if (!card) throw notFound();
        const vehicleTarget = await this.vehicles.findNotificationTarget(dto.vehicleId, scope);
        if (vehicleTarget?.driver?.userId) {
            await this.notifyUser(vehicleTarget.driver.userId, 'Tarjeta asignada', 'Se asigno una tarjeta a tu vehiculo.', this.cardReference(card, vehicleTarget), NotificationType.info);
        }
        void this.audit.recordCard({
            action: 'card_vehicle_assigned',
            resourceType: 'Card',
            resourceId: card.id,
            before: { vehicleId: current.vehicleId, assignmentMode: current.assignmentMode, assignedAt: current.assignedAt },
            after: { vehicleId: card.vehicleId, assignmentMode: card.assignmentMode, assignedAt: card.assignedAt },
        });
        return { id: card.id, vehicleId: card.vehicleId, assignmentMode: card.assignmentMode, assignedAt: card.assignedAt };
    }

    async updateAssignment(id: string, dto: UpdateCardAssignmentDto, scope?: CompanyScope) {
        if (dto.assignmentMode === CardAssignmentMode.unassigned || dto.vehicleId === null) {
            return this.unassign(id, scope);
        }

        if (!dto.vehicleId) throw invalidRelation();
        return this.assignVehicle(id, { vehicleId: dto.vehicleId, assignedAt: dto.assignedAt }, scope);
    }

    async unassign(id: string, scope?: CompanyScope) {
        const current = await this.repository.findById(id, scope);
        if (!current) throw notFound();
        if (current.status !== Status.active) throw invalidRelation();

        const card = await this.repository.update(
            id,
            {
                vehicleId: null,
                assignmentMode: CardAssignmentMode.unassigned,
                assignedAt: null,
            },
            scope
        );
        if (!card) throw notFound();
        const vehicleTarget = current.vehicleId ? await this.vehicles.findNotificationTarget(current.vehicleId, scope) : null;
        if (vehicleTarget?.driver?.userId) {
            await this.notifyUser(vehicleTarget.driver.userId, 'Tarjeta desasignada', 'Se quito una tarjeta de tu vehiculo.', this.cardReference(current, vehicleTarget), NotificationType.warning);
        }
        void this.audit.recordCard({
            action: 'card_unassigned',
            resourceType: 'Card',
            resourceId: card.id,
            before: { vehicleId: current.vehicleId, assignmentMode: current.assignmentMode, assignedAt: current.assignedAt },
            after: { vehicleId: card.vehicleId, assignmentMode: card.assignmentMode, assignedAt: card.assignedAt },
        });
        return { id: card.id, vehicleId: card.vehicleId, assignmentMode: card.assignmentMode, assignedAt: card.assignedAt };
    }

    private async notifyUser(userId: string, title: string, message: string, detail: string, type: NotificationType): Promise<void> {
        await this.notifications.createForUser(userId, { title, message, detail, type }).catch(() => null);
    }

    private cardReference(card: { externalId?: string | null; id: string }, vehicle?: { plates?: string | null; economicNumber?: string | null } | null): string {
        const cardLabel = card.externalId ? `Tarjeta ${card.externalId}` : `Tarjeta ${card.id}`;
        if (!vehicle) return cardLabel;
        const vehicleLabel = vehicle.economicNumber ? `${vehicle.economicNumber} (${vehicle.plates ?? 'sin placas'})` : (vehicle.plates ?? 'vehiculo sin placas');
        return `${cardLabel} - ${vehicleLabel}`;
    }

    private buildWhere(dto: FindCardsDto, scope?: CompanyScope): Prisma.CardWhereInput {
        return {
            subCompanyId: scopedSubCompanyIdFilter(dto.subCompanyId, scope),
            subCompany: subCompanyScopeWhere(scope),
            vehicleId: dto.vehicleId,
            designFuelId: dto.designFuelId,
            assignmentMode: dto.assignmentMode,
            status: dto.status,
            ...(dto.search ? { OR: this.cardSearch(dto.search) } : {}),
        };
    }

    private cardSearch(search: string): Prisma.CardWhereInput[] {
        const contains: Prisma.StringFilter = { contains: search, mode: 'insensitive' };

        return [
            { externalId: contains },
            { stock: { is: { externalId: contains } } },
            { stock: { is: { maskedPan: contains } } },
            { stock: { is: { clientId: contains } } },
            { stock: { is: { providerStatus: contains } } },
            { subCompany: { key: contains } },
            { subCompany: { name: contains } },
            { vehicle: { is: { plates: contains } } },
            { vehicle: { is: { economicNumber: contains } } },
            { designFuel: { is: { code: contains } } },
            { designFuel: { is: { name: contains } } },
        ];
    }

    private mapCard(card: CardRecord) {
        return {
            ...card,
            stock: this.cardcloud.serializeStockSummary(card.stock),
        };
    }

    private formatAssignmentMode(mode: CardAssignmentMode): string {
        if (mode === CardAssignmentMode.vehicle) return 'Vehiculo';
        return 'Sin asignar';
    }

    private cardAuditSnapshot(card: CardRecord) {
        const { stock: _stock, ...snapshot } = card;
        return snapshot;
    }

    private syncResultAuditSummary(result: { requested: number; unique: number; created: number; updated: number; unchanged: number }) {
        return {
            requested: result.requested,
            unique: result.unique,
            created: result.created,
            updated: result.updated,
            unchanged: result.unchanged,
        };
    }

    private async resolveCardcloudTarget(subCompanyId: string, scope?: CompanyScope): Promise<{ id: string; cardcloudSubaccountId: string }> {
        const target = await this.relations.findActiveSubCompanyCardcloudTarget(subCompanyId, scope);
        if (!target?.cardcloudSubaccountId) throw invalidRelation();

        return { id: target.id, cardcloudSubaccountId: target.cardcloudSubaccountId };
    }

    private assertExcelFile(file?: UploadedFile): asserts file is UploadedFile {
        if (!file) throw new BadRequestException('El archivo Excel es obligatorio.');
        if (!file.buffer || file.buffer.length === 0 || file.size === 0) throw new BadRequestException('El archivo Excel esta vacio.');

        const extension = extname(file.originalname).toLowerCase();
        if (extension !== '.xlsx') throw new BadRequestException('El archivo debe ser un Excel valido (.xlsx).');

        const mimeType = file.mimetype?.toLowerCase();
        if (mimeType && !EXCEL_MIME_TYPES.has(mimeType)) throw new BadRequestException('El archivo debe ser un Excel valido (.xlsx).');
    }

    private async parseAssignCardsExcel(file: UploadedFile): Promise<ParsedAssignCardsExcelRow[]> {
        const workbook = new ExcelJS.Workbook();

        try {
            const excelBuffer = Buffer.from(file.buffer) as unknown as Parameters<ExcelJS.Xlsx['load']>[0];
            await workbook.xlsx.load(excelBuffer);
        } catch {
            throw new BadRequestException('No se pudo leer el archivo Excel.');
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) throw new BadRequestException('El archivo Excel no contiene hojas.');

        const headerRow = worksheet.getRow(1);
        const clientIdColumn = this.findHeaderColumn(headerRow, CLIENT_ID_HEADERS);
        const externalIdColumn = this.findHeaderColumn(headerRow, CARD_HEADERS);
        const maskedPanColumn = this.findHeaderColumn(headerRow, MASKED_PAN_HEADERS);
        const providerStatusColumn = this.findHeaderColumn(headerRow, PROVIDER_STATUS_HEADERS);
        const subCompanyColumn = this.findHeaderColumn(headerRow, SUB_COMPANY_HEADERS);
        const descriptionColumn = this.findHeaderColumn(headerRow, DESCRIPTION_HEADERS);

        if (!clientIdColumn) throw new BadRequestException('El Excel debe incluir una columna clientId.');

        const rows: ParsedAssignCardsExcelRow[] = [];
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            if (!row.hasValues) continue;

            const clientId = this.cellValueToText(row.getCell(clientIdColumn).value) || null;
            const externalId = externalIdColumn ? this.cellValueToText(row.getCell(externalIdColumn).value) || null : null;
            const maskedPan = maskedPanColumn ? this.cellValueToText(row.getCell(maskedPanColumn).value) || null : null;
            const providerStatus = providerStatusColumn ? this.cellValueToText(row.getCell(providerStatusColumn).value) || null : null;
            const subCompany = subCompanyColumn ? this.cellValueToText(row.getCell(subCompanyColumn).value) || null : null;
            const description = descriptionColumn ? this.cellValueToText(row.getCell(descriptionColumn).value) || null : null;

            if (!clientId && !externalId && !maskedPan && !providerStatus && !subCompany && !description) continue;

            rows.push({
                row: rowNumber,
                clientId,
                externalId,
                maskedPan,
                providerStatus,
                subCompany,
                description,
            });
        }

        return rows;
    }

    private findHeaderColumn(row: ExcelJS.Row, acceptedHeaders: Set<string>): number | null {
        let columnNumber: number | null = null;
        row.eachCell((cell, colNumber) => {
            if (columnNumber) return;
            if (acceptedHeaders.has(this.normalizeHeader(cell.value))) {
                columnNumber = colNumber;
            }
        });

        return columnNumber;
    }

    private resolveAssignCardsExcelCandidateRows(rows: ParsedAssignCardsExcelRow[], results: AssignCardsExcelResult[]): ParsedAssignCardsExcelRow[] {
        const candidates: ParsedAssignCardsExcelRow[] = [];

        for (const row of rows) {
            if (!row.clientId && !row.externalId && !row.maskedPan && !row.providerStatus && !row.subCompany && !row.description) {
                results.push(this.assignCardsExcelResult(row, 'omitted', 'Fila omitida: no contiene clientId.'));
                continue;
            }

            if (!row.clientId) {
                results.push(this.assignCardsExcelResult(row, 'failed', 'La columna clientId es obligatoria.'));
                continue;
            }

            candidates.push(row);
        }

        return candidates;
    }

    private removeDuplicateAssignCardsClientIds(rows: ParsedAssignCardsExcelRow[], results: AssignCardsExcelResult[]): ParsedAssignCardsExcelRow[] {
        const counts = new Map<string, number>();
        for (const row of rows) {
            if (!row.clientId) continue;
            counts.set(row.clientId, (counts.get(row.clientId) ?? 0) + 1);
        }

        return rows.filter((row) => {
            if (!row.clientId || counts.get(row.clientId) === 1) return true;
            results.push(this.assignCardsExcelResult(row, 'failed', 'clientId duplicado en el archivo.'));
            return false;
        });
    }

    private async resolveAssignCardsExcelRows(rows: ParsedAssignCardsExcelRow[], results: AssignCardsExcelResult[], scope?: CompanyScope): Promise<ResolvedAssignCardsExcelRow[]> {
        if (rows.length === 0) return [];

        const clientIds = [...new Set(rows.map((row) => row.clientId).filter((clientId): clientId is string => Boolean(clientId)))];
        const stockRecords = await this.repository.findAssignableStockByClientIdsForSubCompanyAssignment(clientIds, scope);
        const stockByClientId = new Map<string, AssignableStockExcelRecord[]>();

        for (const stock of stockRecords) {
            if (!stock.clientId) continue;
            stockByClientId.set(stock.clientId, [...(stockByClientId.get(stock.clientId) ?? []), stock]);
        }

        const resolvedRows: ResolvedAssignCardsExcelRow[] = [];
        for (const row of rows) {
            const matches = row.clientId ? (stockByClientId.get(row.clientId) ?? []) : [];

            if (matches.length === 0) {
                results.push(this.assignCardsExcelResult(row, 'failed', 'No se encontro una tarjeta disponible para el clientId indicado.'));
                continue;
            }

            if (matches.length > 1) {
                results.push(this.assignCardsExcelResult(row, 'failed', 'El clientId corresponde a multiples tarjetas disponibles.'));
                continue;
            }

            const stock = matches[0];
            resolvedRows.push({
                ...row,
                clientId: stock.clientId!,
                externalId: stock.externalId,
                maskedPan: row.maskedPan ?? stock.maskedPan,
                providerStatus: row.providerStatus ?? stock.providerStatus,
                subCompany: row.subCompany ?? stock.subCompany?.name ?? null,
                stockId: stock.id,
            });
        }

        return resolvedRows;
    }

    private applyAssignCardsExcelLimit(rows: ParsedAssignCardsExcelRow[], results: AssignCardsExcelResult[]): ParsedAssignCardsExcelRow[] {
        if (rows.length <= ASSIGN_CARDS_EXCEL_MAX_ITEMS) return rows;

        for (const row of rows.slice(ASSIGN_CARDS_EXCEL_MAX_ITEMS)) {
            results.push(this.assignCardsExcelResult(row, 'failed', `El limite por archivo es de ${ASSIGN_CARDS_EXCEL_MAX_ITEMS} tarjetas.`));
        }

        return rows.slice(0, ASSIGN_CARDS_EXCEL_MAX_ITEMS);
    }

    private assignCardsExcelResult(
        row: ParsedAssignCardsExcelRow,
        status: AssignCardsExcelRowStatus,
        message: string,
        cardId: string | null = null,
        stockId: string | null = null
    ): AssignCardsExcelResult {
        return {
            row: row.row,
            clientId: row.clientId,
            externalId: row.externalId,
            maskedPan: row.maskedPan,
            providerStatus: row.providerStatus,
            subCompany: row.subCompany,
            description: row.description,
            status,
            stockId,
            cardId,
            message,
        };
    }

    private normalizeHeader(value: unknown): string {
        return this.cellValueToText(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    private cellValueToText(value: unknown): string {
        if (value === undefined || value === null) return '';
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
        if (value instanceof Date) return value.toISOString();

        if (this.isRecord(value)) {
            if (typeof value.text === 'string') return value.text.trim();
            if ('result' in value) return this.cellValueToText(value.result);
            if (Array.isArray(value.richText))
                return value.richText
                    .map((entry) => (this.isRecord(entry) && typeof entry.text === 'string' ? entry.text : ''))
                    .join('')
                    .trim();
        }

        return '';
    }

    private autosizeWorksheet(worksheet: ExcelJS.Worksheet): void {
        worksheet.getRow(1).font = { bold: true };
        worksheet.columns.forEach((column) => {
            let width = 14;
            column.eachCell?.({ includeEmpty: true }, (cell) => {
                width = Math.max(width, this.cellValueToText(cell.value).length + 2);
            });
            column.width = Math.min(width, 72);
        });
    }

    private resolveCardIdsFromResponse(response: unknown, fallback: string[]): string[] {
        if (!this.isRecord(response) || !Array.isArray(response.cards)) return fallback;

        const resolved = response.cards.map((card) => this.resolveCardExternalId(card)).filter((externalId): externalId is string => Boolean(externalId));
        return resolved.length > 0 ? resolved : fallback;
    }

    private async fetchAllSubaccountCards(subaccountId: string): Promise<CardcloudSubaccountCard[]> {
        const first = (await this.cardcloud.getSubaccountCards(subaccountId, { page: '1' })) as CardcloudSubaccountCardsRaw;
        const all = [...(first.cards ?? [])];
        const totalPages = this.resolveTotalPages(first.total_pages);

        for (let page = 2; page <= totalPages; page++) {
            const current = (await this.cardcloud.getSubaccountCards(subaccountId, { page: String(page) })) as CardcloudSubaccountCardsRaw;
            all.push(...(current.cards ?? []));
        }

        return all;
    }

    private resolveTotalPages(value: string | number | null | undefined): number {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return 1;
        return Math.floor(parsed);
    }

    private resolveCardExternalId(card: unknown): string | null {
        if (!this.isRecord(card)) return null;

        const id = card.card_id ?? card.card_external_id;
        if (typeof id !== 'string') return null;

        const clean = id.trim();
        return clean || null;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    private extractPanDigits(response: unknown): string {
        const source = this.isRecord(response) && this.isRecord(response.sensitive_data_raw) ? response.sensitive_data_raw : response;
        const pan = this.isRecord(source) ? source.pan : null;
        const digits = typeof pan === 'string' ? pan.replace(/\D/g, '') : '';
        if (digits.length < 8) throw new BadRequestException('No pudimos obtener los datos necesarios para validar la tarjeta.');
        return digits;
    }

    private extractValidatedCardId(response: unknown): string | null {
        if (!this.isRecord(response)) return null;
        const id = response.card_id ?? response.card_external_id;
        return typeof id === 'string' && id.trim() ? id.trim() : null;
    }
}
