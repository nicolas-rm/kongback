import { BadRequestException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CardAssignmentMode, NotificationType, Prisma, Status } from '@prisma/client';
import ExcelJS from 'exceljs';
import { extname } from 'node:path';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nHttpException } from '@/i18n';
import { PrismaService } from '@/prisma/prisma.service';
import { invalidRelation, notFound } from '@/modules/business/business.helpers';
import { CardcloudExternalService } from '@/modules/cardcloud/cardcloud-external.service';
import { subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import type { ExportQueryDto } from '@/utilities/export/export-query.dto';
import { createExcelExport, EXCEL_EXPORT_MAX_ROWS, formatBoolean, formatStatus, sanitizeFilenamePart, valueOrDash } from '@/utilities/export/excel-export';
import {
    AssignCardcloudCardsBulkDto,
    AssignCardcloudCardsDto,
    AssignCardcloudSubCompanyDto,
    CardcloudDateRangeQueryDto,
    CardcloudPageQueryDto,
    CreateCardcloudSubaccountDto,
    DownloadCardcloudTransferBulkExcelDto,
    FindCardcloudStockDto,
    TransferCardcloudFundsBulkDto,
    TransferCardcloudFundsBulkExcelDto,
    TransferCardcloudFundsDto,
    UpdateCardcloudCardNipDto,
    ValidateCardcloudCardDto,
} from '@/modules/cardcloud/dto/cardcloud-proxy.dto';
import type { UploadedFile } from '@/modules/documents/types/uploaded-file.type';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import type { PaginatedResult } from '@/utilities/pagination/pagination.dto';
import type {
    CardcloudAccountCardsResponse,
    CardcloudAccountCard,
    CardcloudAccountMovementsResponse,
    CardcloudAccountResponse,
    CardcloudAssignCardsResponse,
    CardcloudCardCvvResponse,
    CardcloudCardDetail,
    CardcloudCardMovementDetail,
    CardcloudCardMovementsResponse,
    CardcloudCardSensitiveDataResponse,
    CardcloudCardStatusChangeResponse,
    CardcloudCreatedSubaccount,
    CardcloudStockResponse,
    CardcloudStockSummaryResponse,
    CardcloudSubaccount,
    CardcloudSubaccountCardsResponse,
    CardcloudSubaccountDetail,
    CardcloudSubaccountMovementsResponse,
    CardcloudSubaccountsResponse,
    CardcloudTransferBulkExcelRowResult,
    CardcloudTransferBulkExcelRowStatus,
    CardcloudTransferBulkExcelTemplateResponse,
    CardcloudTransferFundsBulkItemResult,
    CardcloudTransferFundsBulkResponse,
    CardcloudTransferFundsBulkExcelResponse,
    CardcloudTransferFundsResponse,
    CardcloudUpdateCardNipResponse,
    CardcloudValidateCardResponse,
    CardcloudVisibleSubaccount,
    CardcloudVisibleSubaccountsResponse,
    SyncCardcloudStockResult,
} from '@/modules/cardcloud/types/cardcloud-provider.types';

type ParsedTransferBulkExcelRow = {
    row: number;
    clientId: string | null;
    amount: number | null;
    amountProvided: boolean;
    description: string | null;
};

type ResolvedTransferBulkExcelRow = ParsedTransferBulkExcelRow & {
    destination: string;
};

type TransferBulkExcelInternalResult = CardcloudTransferBulkExcelRowResult;

const LOCAL_STOCK_SELECT = {
    id: true,
    externalId: true,
    subCompanyId: true,
    assignedCardId: true,
    maskedPan: true,
    clientId: true,
    balance: true,
    providerStatus: true,
    assignedCard: {
        select: {
            id: true,
            assignmentMode: true,
            status: true,
        },
    },
    subCompany: {
        select: {
            id: true,
            companyId: true,
            key: true,
            name: true,
        },
    },
} satisfies Prisma.CardcloudSelect;

type LocalStockRecord = Prisma.CardcloudGetPayload<{ select: typeof LOCAL_STOCK_SELECT }>;

const ASSIGNABLE_LOCAL_STOCK_SELECT = {
    id: true,
    subCompanyId: true,
    externalId: true,
    assignedCard: {
        select: {
            id: true,
            subCompanyId: true,
        },
    },
} satisfies Prisma.CardcloudSelect;

type AssignableLocalStockRecord = Prisma.CardcloudGetPayload<{ select: typeof ASSIGNABLE_LOCAL_STOCK_SELECT }>;

type CardcloudSubCompanyTarget = {
    id: string;
    cardcloudSubaccountId: string;
};

type CardcloudExternalAssignmentResult = 'assigned' | 'already_assigned' | 'skipped_same_sub_company';

type LinkedCardcloudSubaccount = {
    id: string;
    key: string;
    name: string;
    companyId: string;
    cardcloudSubaccountId: string;
};

type LinkedCardcloudSubaccountSummary = {
    id: string;
    key: string;
    name: string;
    companyId: string;
};

const PAGE_BATCH_SIZE = 5;
const DB_CHUNK_SIZE = 50;
const PAGE_BATCH_DELAY_MS = 300;
const TRANSFER_BULK_EXCEL_MAX_ITEMS = 50;
const TRANSFER_BULK_EXCEL_FILENAME = 'plantilla-fondeo-subempresa.xlsx';
const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXCEL_MIME_TYPES = new Set([EXCEL_MIME_TYPE, 'application/octet-stream']);
const CLIENT_ID_HEADERS = new Set(['clientid', 'client_id', 'client id', 'clienteid', 'cliente_id', 'cliente id']);
const AMOUNT_HEADERS = new Set(['amount', 'monto', 'importe']);
const DESCRIPTION_HEADERS = new Set(['description', 'descripcion', 'concepto', 'detalle']);

@Injectable()
export class CardcloudService {
    private readonly logger = new Logger(CardcloudService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly external: CardcloudExternalService,
        private readonly cryptoService: CryptoService,
        private readonly notifications: NotificationsService,
        private readonly audit: AuditService
    ) {}

    async getCardMovement(uuid: string): Promise<CardcloudCardMovementDetail> {
        const movement = await this.external.get<CardcloudCardMovementDetail>(`/v1/card/movement/${uuid}`);
        void this.audit.recordCardcloud({ action: 'cardcloud_card_movement_consulted', resourceType: 'CardcloudCardMovement', resourceId: uuid, externalPath: `/v1/card/movement/${uuid}` });
        return movement;
    }

    async getCard(uuid: string): Promise<CardcloudCardDetail> {
        const card = await this.external.get<CardcloudCardDetail>(`/v1/card/${uuid}`);
        void this.audit.recordCardcloud({ action: 'cardcloud_card_consulted', resourceType: 'CardcloudCard', resourceId: uuid, externalPath: `/v1/card/${uuid}` });
        return card;
    }

    async getCardMovements(uuid: string, query: CardcloudDateRangeQueryDto): Promise<CardcloudCardMovementsResponse> {
        const movements = await this.external.get<CardcloudCardMovementsResponse>(`/v1/card/${uuid}/movements`, this.dateRangeParams(query));
        void this.audit.recordCardcloud({
            action: 'cardcloud_card_movements_consulted',
            resourceType: 'CardcloudCard',
            resourceId: uuid,
            externalPath: `/v1/card/${uuid}/movements`,
            metadata: { from: query.from, to: query.to },
        });
        return movements;
    }

    async exportCardMovements(uuid: string, query: CardcloudDateRangeQueryDto) {
        const response = await this.getCardMovements(uuid, query);
        const movements = response.movements.slice(0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordCardcloud({
            action: 'cardcloud_card_movements_exported',
            resourceType: 'CardcloudCard',
            resourceId: uuid,
            externalPath: `/v1/card/${uuid}/movements`,
            metadata: { rows: movements.length, from: query.from, to: query.to, format: query.format ?? 'xlsx' },
        });

        return createExcelExport(
            `movimientos-tarjeta-${sanitizeFilenamePart(uuid)}.xlsx`,
            'Movimientos tarjeta',
            [
                { header: 'Movimiento ID', value: (movement) => movement.movement_id },
                { header: 'Fecha', value: (movement) => valueOrDash(movement.date) },
                { header: 'Tipo', value: (movement) => valueOrDash(movement.type) },
                { header: 'Descripcion', value: (movement) => valueOrDash(movement.description) },
                { header: 'Estado', value: (movement) => valueOrDash(movement.status) },
                { header: 'Autorizacion', value: (movement) => valueOrDash(movement.authorization_code) },
                { header: 'Monto', value: (movement) => valueOrDash(movement.amount) },
                { header: 'Saldo', value: (movement) => valueOrDash(movement.balance) },
            ],
            movements,
            query.format
        );
    }

    async getCardSensitiveData(uuid: string): Promise<CardcloudCardSensitiveDataResponse> {
        const data = await this.external.get<CardcloudCardSensitiveDataResponse>(`/v1/card/${uuid}/sensitive`);
        void this.audit.recordCardcloud({ action: 'cardcloud_card_sensitive_data_consulted', resourceType: 'CardcloudCard', resourceId: uuid, externalPath: `/v1/card/${uuid}/sensitive` });
        return data;
    }

    async getCardCvv(uuid: string): Promise<CardcloudCardCvvResponse> {
        const cvv = await this.external.get<CardcloudCardCvvResponse>(`/v1/card/${uuid}/cvv`);
        void this.audit.recordCardcloud({ action: 'cardcloud_card_cvv_consulted', resourceType: 'CardcloudCard', resourceId: uuid, externalPath: `/v1/card/${uuid}/cvv` });
        return cvv;
    }

    async updateCardNip(uuid: string, dto: UpdateCardcloudCardNipDto): Promise<CardcloudUpdateCardNipResponse> {
        const result = await this.external.patch<CardcloudUpdateCardNipResponse>(`/v1/card/${uuid}/update_nip`, dto);
        void this.audit.recordCardcloud({ action: 'cardcloud_card_nip_updated', resourceType: 'CardcloudCard', resourceId: uuid, externalPath: `/v1/card/${uuid}/update_nip` });
        return result;
    }

    async validateCard(dto: ValidateCardcloudCardDto): Promise<CardcloudValidateCardResponse> {
        const result = await this.external.post<CardcloudValidateCardResponse>('/card/validate', dto);
        void this.audit.recordCardcloud({ action: 'cardcloud_card_validated', resourceType: 'CardcloudCard', externalPath: '/card/validate' });
        return result;
    }

    async blockCard(uuid: string): Promise<CardcloudCardStatusChangeResponse> {
        const result = await this.external.post<CardcloudCardStatusChangeResponse>(`/v1/card/${uuid}/block`);
        void this.audit.recordCardcloud({ action: 'cardcloud_card_blocked', resourceType: 'CardcloudCard', resourceId: uuid, externalPath: `/v1/card/${uuid}/block` });
        return result;
    }

    async unblockCard(uuid: string): Promise<CardcloudCardStatusChangeResponse> {
        const result = await this.external.post<CardcloudCardStatusChangeResponse>(`/v1/card/${uuid}/unblock`);
        void this.audit.recordCardcloud({ action: 'cardcloud_card_unblocked', resourceType: 'CardcloudCard', resourceId: uuid, externalPath: `/v1/card/${uuid}/unblock` });
        return result;
    }

    async getSubaccounts(scope?: CompanyScope): Promise<CardcloudSubaccountsResponse | CardcloudVisibleSubaccountsResponse> {
        const response = await this.external.get<CardcloudSubaccountsResponse>('/v1/subaccounts');
        if (!scope?.companyId) {
            void this.audit.recordCardcloud({ action: 'cardcloud_subaccounts_consulted', resourceType: 'CardcloudSubaccount', externalPath: '/v1/subaccounts' });
            return response;
        }

        const linkedSubaccounts = await this.findLinkedCardcloudSubaccounts(scope);
        const filtered = this.filterLinkedSubaccountsResponse(response, linkedSubaccounts);
        void this.audit.recordCardcloud({
            action: 'cardcloud_subaccounts_consulted',
            resourceType: 'CardcloudSubaccount',
            externalPath: '/v1/subaccounts',
            metadata: { linked: linkedSubaccounts.size },
        });
        return filtered;
    }

    async exportSubaccounts(dto: ExportQueryDto, scope?: CompanyScope) {
        const response = await this.getSubaccounts(scope);
        const subaccounts = response.subaccounts.slice(0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordCardcloud({
            action: 'cardcloud_subaccounts_exported',
            resourceType: 'CardcloudSubaccount',
            externalPath: '/v1/subaccounts',
            metadata: { rows: subaccounts.length, companyId: scope?.companyId, format: dto.format ?? 'xlsx' },
        });

        return createExcelExport(
            'subcuentas-cardcloud.xlsx',
            'Subcuentas',
            [
                { header: 'Subcuenta ID', value: (subaccount) => subaccount.subaccount_id },
                { header: 'External ID', value: (subaccount) => valueOrDash(subaccount.external_id) },
                { header: 'Descripcion', value: (subaccount) => valueOrDash(subaccount.description) },
                { header: 'Saldo', value: (subaccount) => valueOrDash(subaccount.wallet.balance) },
                { header: 'CLABE', value: (subaccount) => valueOrDash(subaccount.wallet.clabe) },
                { header: 'Movimientos recientes', value: (subaccount) => subaccount.wallet.last_movements.length },
                { header: 'Subcompania local', value: (subaccount) => this.localSubCompanyLabel(subaccount) },
            ],
            subaccounts,
            dto.format
        );
    }

    async getSubaccount(uuid: string, scope?: CompanyScope): Promise<CardcloudSubaccountDetail> {
        await this.assertLinkedSubaccount(uuid, scope);
        const subaccount = await this.external.get<CardcloudSubaccountDetail>(`/v1/subaccounts/${uuid}`);
        void this.audit.recordCardcloud({ action: 'cardcloud_subaccount_consulted', resourceType: 'CardcloudSubaccount', resourceId: uuid, externalPath: `/v1/subaccounts/${uuid}` });
        return subaccount;
    }

    async getSubaccountCards(uuid: string, query: CardcloudPageQueryDto, scope?: CompanyScope): Promise<CardcloudSubaccountCardsResponse> {
        await this.assertLinkedSubaccount(uuid, scope);
        const cards = await this.external.get<CardcloudSubaccountCardsResponse>(`/v1/subaccounts/${uuid}/cards`, { page: query.page });
        void this.audit.recordCardcloud({
            action: 'cardcloud_subaccount_cards_consulted',
            resourceType: 'CardcloudSubaccount',
            resourceId: uuid,
            externalPath: `/v1/subaccounts/${uuid}/cards`,
            metadata: { page: query.page },
        });
        return cards;
    }

    async exportSubaccountCards(uuid: string, query: CardcloudPageQueryDto, scope?: CompanyScope) {
        const response = await this.getSubaccountCards(uuid, query, scope);
        const cards = response.cards.slice(0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordCardcloud({
            action: 'cardcloud_subaccount_cards_exported',
            resourceType: 'CardcloudSubaccount',
            resourceId: uuid,
            externalPath: `/v1/subaccounts/${uuid}/cards`,
            metadata: { rows: cards.length, page: query.page, companyId: scope?.companyId, format: query.format ?? 'xlsx' },
        });

        return createExcelExport(
            `tarjetas-subcuenta-${sanitizeFilenamePart(uuid)}.xlsx`,
            'Tarjetas subcuenta',
            [
                { header: 'Tarjeta ID', value: (card) => card.card_id },
                { header: 'External ID', value: (card) => valueOrDash(card.card_external_id) },
                { header: 'Client ID', value: (card) => valueOrDash(card.client_id) },
                { header: 'PAN enmascarado', value: (card) => valueOrDash(card.masked_pan) },
                { header: 'Tipo', value: (card) => valueOrDash(card.card_type) },
                { header: 'Marca', value: (card) => valueOrDash(card.brand) },
                { header: 'BIN', value: (card) => valueOrDash(card.bin) },
                { header: 'Saldo', value: (card) => valueOrDash(card.balance) },
                { header: 'CLABE', value: (card) => valueOrDash(card.clabe) },
                { header: 'Estado', value: (card) => valueOrDash(card.status) },
            ],
            cards,
            query.format
        );
    }

    async createSubaccount(dto: CreateCardcloudSubaccountDto): Promise<CardcloudCreatedSubaccount> {
        const subaccount = await this.external.post<CardcloudCreatedSubaccount>('/v1/subaccounts', dto);
        void this.audit.recordCardcloud({
            action: 'cardcloud_subaccount_created',
            resourceType: 'CardcloudSubaccount',
            resourceId: this.resolveSubaccountId(subaccount) ?? undefined,
            externalPath: '/v1/subaccounts',
        });
        return subaccount;
    }

    async createSubaccountAndResolveId(dto: CreateCardcloudSubaccountDto): Promise<string> {
        const response = await this.createSubaccount(dto);
        const subaccountId = this.resolveSubaccountId(response);
        if (!subaccountId) {
            throw new I18nHttpException(HttpStatus.BAD_GATEWAY, I18N_KEYS.errors.internal.unprocessed, 'No pudimos completar la operacion con el servicio externo. Intenta mas tarde.');
        }

        return subaccountId;
    }

    async getSubaccountMovements(uuid: string, query: CardcloudDateRangeQueryDto, scope?: CompanyScope): Promise<CardcloudSubaccountMovementsResponse> {
        await this.assertLinkedSubaccount(uuid, scope);
        const movements = await this.external.get<CardcloudSubaccountMovementsResponse>(`/v1/subaccounts/${uuid}/movements`, this.dateRangeParams(query));
        void this.audit.recordCardcloud({
            action: 'cardcloud_subaccount_movements_consulted',
            resourceType: 'CardcloudSubaccount',
            resourceId: uuid,
            externalPath: `/v1/subaccounts/${uuid}/movements`,
            metadata: { from: query.from, to: query.to },
        });
        return movements;
    }

    async exportSubaccountMovements(uuid: string, query: CardcloudDateRangeQueryDto, scope?: CompanyScope) {
        const response = await this.getSubaccountMovements(uuid, query, scope);
        const movements = response.movements.slice(0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordCardcloud({
            action: 'cardcloud_subaccount_movements_exported',
            resourceType: 'CardcloudSubaccount',
            resourceId: uuid,
            externalPath: `/v1/subaccounts/${uuid}/movements`,
            metadata: { rows: movements.length, from: query.from, to: query.to, companyId: scope?.companyId, format: query.format ?? 'xlsx' },
        });

        return createExcelExport(
            `movimientos-subcuenta-${sanitizeFilenamePart(uuid)}.xlsx`,
            'Movimientos subcuenta',
            [
                { header: 'Movimiento ID', value: (movement) => movement.movement_id },
                { header: 'Fecha', value: (movement) => valueOrDash(movement.date) },
                { header: 'Tipo', value: (movement) => valueOrDash(movement.type) },
                { header: 'Descripcion', value: (movement) => valueOrDash(movement.description) },
                { header: 'Referencia', value: (movement) => valueOrDash(movement.reference) },
                { header: 'Autorizacion', value: (movement) => valueOrDash(movement.authorization_code) },
                { header: 'Monto', value: (movement) => valueOrDash(movement.amount) },
                { header: 'Saldo', value: (movement) => valueOrDash(movement.balance) },
                { header: 'Tarjeta ID', value: (movement) => valueOrDash(movement.card?.card_id) },
                { header: 'Client ID', value: (movement) => valueOrDash(movement.card?.client_id) },
                { header: 'PAN enmascarado', value: (movement) => valueOrDash(movement.card?.masked_pan) },
            ],
            movements,
            query.format
        );
    }

    async assignCards(dto: AssignCardcloudCardsDto): Promise<CardcloudAssignCardsResponse> {
        const result = await this.external.post<CardcloudAssignCardsResponse>('/v1/account/cards/assign', dto);
        void this.audit.recordCardcloud({ action: 'cardcloud_cards_assigned', resourceType: 'CardcloudCard', externalPath: '/v1/account/cards/assign', metadata: { subaccountId: dto.subaccount_id } });
        return result;
    }

    async assignCardsBulk(dto: AssignCardcloudCardsBulkDto): Promise<CardcloudAssignCardsResponse> {
        const result = await this.external.post<CardcloudAssignCardsResponse>('/v1/account/cards/assign_bulk', dto);
        void this.audit.recordCardcloud({
            action: 'cardcloud_cards_assigned_bulk',
            resourceType: 'CardcloudCard',
            externalPath: '/v1/account/cards/assign_bulk',
            metadata: { subaccountId: dto.subaccount_id, count: dto.cards.length },
        });
        return result;
    }

    async transferFunds(dto: TransferCardcloudFundsDto, actorUserId?: string): Promise<CardcloudTransferFundsResponse> {
        const normalized = this.normalizeTransfer(dto);
        const result = await this.external.post<CardcloudTransferFundsResponse>('/v1/transfer', normalized);
        if (actorUserId) {
            await this.notifyUser(actorUserId, 'Fondeo ejecutado', 'La transferencia Cardcloud se ejecuto correctamente.', `Monto: ${normalized.amount}`, NotificationType.success);
        }
        void this.audit.recordCardcloud({
            action: 'cardcloud_transfer_created',
            resourceType: 'CardcloudTransfer',
            externalPath: '/v1/transfer',
            metadata: { sourceType: normalized.sourceType, destinationType: normalized.destinationType, amount: normalized.amount },
        });
        return result;
    }

    async transferFundsBulk(dto: TransferCardcloudFundsBulkDto, actorUserId?: string): Promise<CardcloudTransferFundsBulkResponse> {
        const results: CardcloudTransferFundsBulkItemResult[] = [];

        for (let index = 0; index < dto.transfers.length; index++) {
            try {
                const data = await this.external.post<CardcloudTransferFundsResponse>('/v1/transfer', this.normalizeTransfer(dto.transfers[index]));
                results.push({ index, success: true, data });
            } catch (error) {
                results.push({ index, success: false, error: this.errorMessage(error) });
            }
        }

        const succeeded = results.filter((result) => result.success).length;
        if (actorUserId) {
            const failed = results.length - succeeded;
            await this.notifyUser(
                actorUserId,
                failed > 0 ? 'Fondeo masivo procesado con errores' : 'Fondeo masivo procesado',
                `Procesadas: ${results.length}. Exitosas: ${succeeded}. Fallidas: ${failed}.`,
                'Revisa el resultado del procesamiento para validar cada movimiento.',
                failed > 0 ? NotificationType.warning : NotificationType.success
            );
        }
        void this.audit.recordCardcloud({
            action: 'cardcloud_transfer_bulk_processed',
            resourceType: 'CardcloudTransfer',
            externalPath: '/v1/transfer',
            metadata: { total: results.length, succeeded, failed: results.length - succeeded },
        });
        return {
            results,
            summary: {
                total: results.length,
                succeeded,
                failed: results.length - succeeded,
            },
        };
    }

    async downloadTransferFundsBulkExcelTemplate(dto: DownloadCardcloudTransferBulkExcelDto): Promise<CardcloudTransferBulkExcelTemplateResponse> {
        const cards = dto.subCompanyId ? await this.findSubCompanyTemplateCards(dto.subCompanyId) : [];
        const workbook = new ExcelJS.Workbook();
        const templateSheet = workbook.addWorksheet('Fondeo');

        templateSheet.addRow(['clientId', 'monto', 'description']);
        for (const card of cards) {
            templateSheet.addRow([card.stock?.clientId ?? '', '', '']);
        }

        const instructionsSheet = workbook.addWorksheet('Instrucciones');
        [
            ['Campo', 'Detalle'],
            ['Hoja a procesar', 'Solo se procesa la primera hoja del archivo.'],
            ['Columnas base', 'clientId, monto, description.'],
            ['Plantilla por subcompania', 'Si envias subCompanyId, la hoja Fondeo se precarga con los clientId de las tarjetas asignadas a esa subcompania.'],
            ['clientId', 'Si viene vacio, la fila se omite.'],
            ['monto', 'Si viene vacio, la fila se omite. Debe ser numerico y su valor absoluto debe ser mayor o igual a 0.01.'],
            ['monto negativo', 'Resta saldo de la tarjeta indicada y lo devuelve a la subcuenta relacionada a su subcompania.'],
            ['description', 'Opcional.'],
            ['Duplicados', 'No repitas clientId dentro del mismo archivo.'],
        ].forEach((row) => instructionsSheet.addRow(row));

        this.autosizeWorksheet(templateSheet);
        this.autosizeWorksheet(instructionsSheet);

        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        void this.audit.recordCardcloud({
            action: 'cardcloud_transfer_bulk_template_downloaded',
            resourceType: 'CardcloudTransfer',
            metadata: { subCompanyId: dto.subCompanyId ?? null, rows: cards.length },
        });
        return {
            filename: TRANSFER_BULK_EXCEL_FILENAME,
            mimeType: EXCEL_MIME_TYPE,
            buffer,
        };
    }

    async transferFundsBulkExcel(dto: TransferCardcloudFundsBulkExcelDto, file?: UploadedFile, actorUserId?: string): Promise<CardcloudTransferFundsBulkExcelResponse> {
        this.assertExcelFile(file);

        const subCompany = await this.prisma.subCompany.findFirst({
            where: {
                id: dto.subCompanyId,
                status: Status.active,
            },
            select: {
                id: true,
                cardcloudSubaccountId: true,
            },
        });

        if (!subCompany) throw notFound();
        if (!subCompany.cardcloudSubaccountId) throw invalidRelation();

        const parsedRows = await this.parseTransferBulkExcel(file);
        const results: TransferBulkExcelInternalResult[] = [];
        const candidateRows = this.resolveCandidateRows(parsedRows, results);
        const rowsWithoutDuplicates = this.removeDuplicateClientIds(candidateRows, results);
        const resolvedRows = await this.resolveTransferBulkExcelRows(subCompany.id, rowsWithoutDuplicates, results);

        if (resolvedRows.length > 0) {
            const processedResults = await this.executeTransferBulkExcelRows(subCompany.cardcloudSubaccountId, resolvedRows);
            results.push(...processedResults);
            void this.syncStock().catch(() => null);
        }

        const orderedResults = results.sort((a, b) => a.row - b.row);
        const summary = {
            totalRows: parsedRows.length,
            prepared: resolvedRows.length,
            succeeded: orderedResults.filter((result) => result.status === 'succeeded').length,
            failed: orderedResults.filter((result) => result.status === 'failed').length,
            omitted: orderedResults.filter((result) => result.status === 'omitted').length,
        };
        if (actorUserId) {
            await this.notifyUser(
                actorUserId,
                summary.failed > 0 ? 'Fondeo por Excel procesado con errores' : 'Fondeo por Excel procesado',
                `Filas: ${summary.totalRows}. Exitosas: ${summary.succeeded}. Fallidas: ${summary.failed}. Omitidas: ${summary.omitted}.`,
                'Revisa el resultado del procesamiento para validar cada fila.',
                summary.failed > 0 ? NotificationType.warning : NotificationType.success
            );
        }

        void this.audit.recordCardcloud({ action: 'cardcloud_transfer_bulk_excel_processed', resourceType: 'CardcloudTransfer', metadata: { subCompanyId: subCompany.id, ...summary } });
        return {
            subCompanyId: subCompany.id,
            results: orderedResults,
            summary,
        };
    }

    private async notifyUser(userId: string, title: string, message: string, detail: string, type: NotificationType): Promise<void> {
        await this.notifications.createForUser(userId, { title, message, detail, type }).catch(() => null);
    }

    async getAccount(): Promise<CardcloudAccountResponse> {
        const account = await this.external.get<CardcloudAccountResponse>('/v1/account');
        void this.audit.recordCardcloud({ action: 'cardcloud_account_consulted', resourceType: 'CardcloudAccount', externalPath: '/v1/account' });
        return account;
    }

    async getAccountMovements(query: CardcloudDateRangeQueryDto): Promise<CardcloudAccountMovementsResponse> {
        const movements = await this.external.get<CardcloudAccountMovementsResponse>('/v1/account/movements', this.dateRangeParams(query));
        void this.audit.recordCardcloud({
            action: 'cardcloud_account_movements_consulted',
            resourceType: 'CardcloudAccount',
            externalPath: '/v1/account/movements',
            metadata: { from: query.from, to: query.to },
        });
        return movements;
    }

    async exportAccountMovements(query: CardcloudDateRangeQueryDto) {
        const response = await this.getAccountMovements(query);
        const movements = response.movements.slice(0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordCardcloud({
            action: 'cardcloud_account_movements_exported',
            resourceType: 'CardcloudAccount',
            externalPath: '/v1/account/movements',
            metadata: { rows: movements.length, from: query.from, to: query.to, format: query.format ?? 'xlsx' },
        });

        return createExcelExport(
            'movimientos-cuenta-cardcloud.xlsx',
            'Movimientos cuenta',
            [
                { header: 'Movimiento ID', value: (movement) => movement.movement_id },
                { header: 'Fecha', value: (movement) => valueOrDash(movement.date) },
                { header: 'Tipo', value: (movement) => valueOrDash(movement.type) },
                { header: 'Descripcion', value: (movement) => valueOrDash(movement.description) },
                { header: 'Referencia', value: (movement) => valueOrDash(movement.reference) },
                { header: 'Monto', value: (movement) => valueOrDash(movement.amount) },
                { header: 'Saldo', value: (movement) => valueOrDash(movement.balance) },
                { header: 'Tarjeta ID', value: (movement) => valueOrDash(movement.card?.card_id) },
                { header: 'Client ID', value: (movement) => valueOrDash(movement.card?.client_id) },
                { header: 'PAN enmascarado', value: (movement) => valueOrDash(movement.card?.masked_pan) },
            ],
            movements,
            query.format
        );
    }

    async findStock(dto: FindCardcloudStockDto, scope?: CompanyScope): Promise<PaginatedResult<CardcloudStockResponse>> {
        const where = this.buildStockWhere(dto, scope);

        const [records, total] = await Promise.all([
            this.prisma.cardcloud.findMany({
                where,
                skip: dto.skip,
                take: dto.actualLimit,
                orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                select: this.localStockSelect(),
            }),
            this.prisma.cardcloud.count({ where }),
        ]);

        void this.audit.recordCardcloud({
            action: 'cardcloud_stock_consulted',
            resourceType: 'CardcloudStock',
            metadata: { total, returned: records.length, subCompanyId: dto.subCompanyId, providerStatus: dto.providerStatus },
        });
        return paginate(
            records.map((record) => this.serializeLocalStock(record)),
            total,
            dto
        );
    }

    async exportStock(dto: FindCardcloudStockDto, scope?: CompanyScope) {
        const where = this.buildStockWhere(dto, scope);
        const records = await this.prisma.cardcloud.findMany({
            where,
            take: EXCEL_EXPORT_MAX_ROWS,
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            select: this.localStockSelect(),
        });
        const stock = records.map((record) => this.serializeLocalStock(record));

        void this.audit.recordCardcloud({
            action: 'cardcloud_stock_exported',
            resourceType: 'CardcloudStock',
            metadata: { rows: stock.length, subCompanyId: dto.subCompanyId, providerStatus: dto.providerStatus, search: dto.search, format: dto.format ?? 'xlsx' },
        });

        return createExcelExport(
            'stock-cardcloud.xlsx',
            'Stock Cardcloud',
            [
                { header: 'ID', value: (item) => item.id },
                { header: 'External ID', value: (item) => item.externalId },
                { header: 'Client ID', value: (item) => valueOrDash(item.clientId) },
                { header: 'PAN enmascarado', value: (item) => valueOrDash(item.maskedPan) },
                { header: 'Saldo', value: (item) => valueOrDash(item.balance) },
                { header: 'Estado proveedor', value: (item) => valueOrDash(item.providerStatus) },
                { header: 'Subcompania', value: (item) => (item.subCompany ? `${item.subCompany.key} - ${item.subCompany.name}` : '-') },
                { header: 'Tarjeta local', value: (item) => formatBoolean(Boolean(item.assignedCardId)) },
                { header: 'Modo local', value: (item) => this.formatCardAssignmentMode(item.assignedCard?.assignmentMode) },
                { header: 'Estado tarjeta local', value: (item) => formatStatus(item.assignedCard?.status) },
            ],
            stock,
            dto.format
        );
    }

    async syncStock(): Promise<SyncCardcloudStockResult> {
        const fetchedCards = await this.fetchAllFromCardcloud();
        const deduped = this.dedupeCards(fetchedCards);
        const externalIds = deduped.cards.map((card) => this.resolveExternalId(card)!);
        let synced = 0;
        let skipped = deduped.skipped;

        for (let i = 0; i < deduped.cards.length; i += DB_CHUNK_SIZE) {
            const chunk = deduped.cards.slice(i, i + DB_CHUNK_SIZE);
            const result = await this.syncChunk(chunk);
            synced += result.synced;
            skipped += result.skipped;
        }

        const removed = await this.prisma.cardcloud.updateMany({
            where: {
                ...(externalIds.length > 0 ? { externalId: { notIn: externalIds } } : {}),
                providerStatus: { not: 'inactive' },
            },
            data: { providerStatus: 'inactive' },
        });

        this.logger.log(`Cardcloud stock sync global synced=${synced} skipped=${skipped} removed=${removed.count}`);
        void this.audit.recordCardcloud({ action: 'cardcloud_stock_synced', resourceType: 'CardcloudStock', metadata: { synced, skipped, removed: removed.count } });
        return { synced, skipped, removed: removed.count };
    }

    async assignSubCompany(id: string, dto: AssignCardcloudSubCompanyDto, scope?: CompanyScope) {
        const [target, assignableStock] = await Promise.all([this.resolveCardcloudSubCompanyTarget(dto.subCompanyId, scope), this.findAssignableLocalStock(id, scope)]);

        const externalAssignment =
            assignableStock.subCompanyId === target.id ? 'skipped_same_sub_company' : await this.assignExternalCardToSubaccount(assignableStock.externalId, target.cardcloudSubaccountId);

        const updated = await this.prisma.$transaction(async (tx) => {
            if (assignableStock.assignedCard && assignableStock.assignedCard.subCompanyId !== target.id) {
                await tx.card.update({
                    where: { id: assignableStock.assignedCard.id },
                    data: {
                        subCompanyId: target.id,
                        vehicleId: null,
                        assignmentMode: CardAssignmentMode.unassigned,
                        assignedAt: null,
                    },
                    select: { id: true },
                });
            }

            return tx.cardcloud.updateMany({
                where: {
                    AND: [{ id }, this.stockScopeWhere(scope, true)],
                },
                data: { subCompanyId: target.id },
            });
        });

        if (updated.count === 0) throw notFound();
        const stock = await this.findLocalStock(id, scope);
        void this.audit.recordCardcloud({
            action: 'cardcloud_stock_sub_company_assigned',
            resourceType: 'CardcloudStock',
            resourceId: id,
            externalPath: '/v1/account/cards/assign_bulk',
            metadata: {
                subCompanyId: target.id,
                cardcloudSubaccountId: target.cardcloudSubaccountId,
                externalCardId: assignableStock.externalId,
                assignedCardId: assignableStock.assignedCard?.id ?? null,
                externalAssignment,
            },
        });
        return stock;
    }

    async unassignSubCompany(id: string, scope?: CompanyScope) {
        const updated = await this.prisma.cardcloud.updateMany({
            where: {
                AND: [{ id }, this.stockScopeWhere(scope, false)],
            },
            data: { subCompanyId: null },
        });

        if (updated.count === 0) throw notFound();
        const stock = await this.findLocalStock(id, scope);
        void this.audit.recordCardcloud({ action: 'cardcloud_stock_sub_company_unassigned', resourceType: 'CardcloudStock', resourceId: id });
        return stock;
    }

    serializeStockSummary(
        stock: {
            id: string;
            externalId: string;
            subCompanyId: string | null;
            assignedCardId: string | null;
            maskedPan: string | null;
            clientId: string | null;
            balance: string | Prisma.Decimal | null;
            providerStatus: string | null;
        } | null
    ): CardcloudStockSummaryResponse | null {
        if (!stock) return null;

        return {
            ...stock,
            maskedPan: this.maskPanKeepingLastFour(stock.maskedPan),
            balance: this.decryptBalance(stock.balance),
        };
    }

    private dateRangeParams(query: CardcloudDateRangeQueryDto) {
        return { from: query.from, to: query.to };
    }

    private async findSubCompanyTemplateCards(subCompanyId: string) {
        const subCompany = await this.prisma.subCompany.findFirst({
            where: {
                id: subCompanyId,
                status: Status.active,
            },
            select: {
                id: true,
            },
        });

        if (!subCompany) throw notFound();

        return this.prisma.card.findMany({
            where: {
                subCompanyId: subCompany.id,
                status: Status.active,
                stock: {
                    is: {
                        clientId: { not: null },
                        assignedCardId: { not: null },
                    },
                },
            },
            select: {
                stock: {
                    select: {
                        clientId: true,
                    },
                },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
    }

    private assertExcelFile(file?: UploadedFile): asserts file is UploadedFile {
        if (!file) throw new BadRequestException('El archivo Excel es obligatorio.');
        if (!file.buffer || file.buffer.length === 0 || file.size === 0) throw new BadRequestException('El archivo Excel esta vacio.');

        const extension = extname(file.originalname).toLowerCase();
        if (extension !== '.xlsx') throw new BadRequestException('El archivo debe ser un Excel valido (.xlsx).');

        const mimeType = file.mimetype?.toLowerCase();
        if (mimeType && !EXCEL_MIME_TYPES.has(mimeType)) throw new BadRequestException('El archivo debe ser un Excel valido (.xlsx).');
    }

    private async parseTransferBulkExcel(file: UploadedFile): Promise<ParsedTransferBulkExcelRow[]> {
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
        const amountColumn = this.findHeaderColumn(headerRow, AMOUNT_HEADERS);
        const descriptionColumn = this.findHeaderColumn(headerRow, DESCRIPTION_HEADERS);

        if (!clientIdColumn) throw new BadRequestException('El Excel debe incluir una columna clientId.');
        if (!amountColumn) throw new BadRequestException('El Excel debe incluir una columna monto.');

        const rows: ParsedTransferBulkExcelRow[] = [];
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            if (!row.hasValues) continue;

            const clientId = this.cellValueToText(row.getCell(clientIdColumn).value) || null;
            const amountText = this.cellValueToText(row.getCell(amountColumn).value);
            const description = descriptionColumn ? this.cellValueToText(row.getCell(descriptionColumn).value) || null : null;

            if (!clientId && !amountText && !description) continue;

            rows.push({
                row: rowNumber,
                clientId,
                amount: amountText ? this.parseExcelAmount(amountText) : null,
                amountProvided: amountText.length > 0,
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

    private resolveCandidateRows(rows: ParsedTransferBulkExcelRow[], results: TransferBulkExcelInternalResult[]): ParsedTransferBulkExcelRow[] {
        const candidates: ParsedTransferBulkExcelRow[] = [];

        for (const row of rows) {
            if (!row.clientId && !row.amountProvided) {
                results.push(this.transferBulkExcelResult(row, 'omitted', 'Fila omitida: no contiene clientId ni monto.'));
                continue;
            }

            if (!row.clientId) {
                results.push(this.transferBulkExcelResult(row, 'omitted', 'Fila omitida: no contiene clientId.'));
                continue;
            }

            if (!row.amountProvided) {
                results.push(this.transferBulkExcelResult(row, 'omitted', 'Fila omitida: no contiene monto.'));
                continue;
            }

            if (row.amount === null || Math.abs(row.amount) < 0.01) {
                results.push(this.transferBulkExcelResult(row, 'failed', 'El monto debe ser un numero con valor absoluto mayor o igual a 0.01.'));
                continue;
            }

            candidates.push(row);
        }

        return candidates;
    }

    private removeDuplicateClientIds(rows: ParsedTransferBulkExcelRow[], results: TransferBulkExcelInternalResult[]): ParsedTransferBulkExcelRow[] {
        const counts = new Map<string, number>();
        for (const row of rows) {
            if (!row.clientId) continue;
            counts.set(row.clientId, (counts.get(row.clientId) ?? 0) + 1);
        }

        return rows.filter((row) => {
            if (!row.clientId || counts.get(row.clientId) === 1) return true;
            results.push(this.transferBulkExcelResult(row, 'failed', 'clientId duplicado en el archivo.'));
            return false;
        });
    }

    private async resolveTransferBulkExcelRows(subCompanyId: string, rows: ParsedTransferBulkExcelRow[], results: TransferBulkExcelInternalResult[]): Promise<ResolvedTransferBulkExcelRow[]> {
        if (rows.length === 0) return [];

        const clientIds = [...new Set(rows.map((row) => row.clientId).filter((clientId): clientId is string => Boolean(clientId)))];
        const cards = await this.prisma.card.findMany({
            where: {
                subCompanyId,
                status: Status.active,
                stock: {
                    is: {
                        clientId: { in: clientIds },
                        assignedCardId: { not: null },
                    },
                },
            },
            select: {
                externalId: true,
                stock: {
                    select: {
                        externalId: true,
                        clientId: true,
                    },
                },
            },
        });

        const cardsByClientId = new Map<string, typeof cards>();
        for (const card of cards) {
            const clientId = card.stock?.clientId;
            if (!clientId) continue;

            cardsByClientId.set(clientId, [...(cardsByClientId.get(clientId) ?? []), card]);
        }

        const resolvedRows: ResolvedTransferBulkExcelRow[] = [];
        for (const row of rows) {
            const matches = row.clientId ? (cardsByClientId.get(row.clientId) ?? []) : [];

            if (matches.length === 0) {
                results.push(this.transferBulkExcelResult(row, 'failed', 'No se encontro una tarjeta activa de esa subcompania para el clientId indicado.'));
                continue;
            }

            if (matches.length > 1) {
                results.push(this.transferBulkExcelResult(row, 'failed', 'El clientId corresponde a multiples tarjetas activas de la subcompania.'));
                continue;
            }

            const destination = matches[0].externalId ?? matches[0].stock?.externalId ?? null;
            if (!destination) {
                results.push(this.transferBulkExcelResult(row, 'failed', 'La tarjeta no tiene una referencia valida en Cardcloud.'));
                continue;
            }

            resolvedRows.push({
                ...row,
                destination,
            });
        }

        return resolvedRows;
    }

    private async executeTransferBulkExcelRows(subaccountId: string, rows: ResolvedTransferBulkExcelRow[]): Promise<TransferBulkExcelInternalResult[]> {
        const results: TransferBulkExcelInternalResult[] = [];

        for (let index = 0; index < rows.length; index += TRANSFER_BULK_EXCEL_MAX_ITEMS) {
            const chunk = rows.slice(index, index + TRANSFER_BULK_EXCEL_MAX_ITEMS);
            const response = await this.transferFundsBulk({
                transfers: chunk.map((row) => ({
                    sourceType: 'subaccount',
                    source: subaccountId,
                    destinationType: 'card',
                    destination: row.destination,
                    amount: row.amount!,
                    description: row.description ?? this.defaultTransferBulkExcelDescription(row),
                })),
            });

            for (const result of response.results) {
                const sourceRow = chunk[result.index];
                if (!sourceRow) throw new BadRequestException('No se pudo correlacionar el resultado del fondeo masivo.');

                if (result.success) {
                    results.push({
                        row: sourceRow.row,
                        clientId: sourceRow.clientId,
                        amount: sourceRow.amount,
                        description: sourceRow.description,
                        status: 'succeeded',
                        newBalance: this.extractStringField(result.data, ['new_balance', 'newBalance', 'balance']),
                        message: 'Transferencia procesada correctamente.',
                    });
                    continue;
                }

                results.push({
                    row: sourceRow.row,
                    clientId: sourceRow.clientId,
                    amount: sourceRow.amount,
                    description: sourceRow.description,
                    status: 'failed',
                    newBalance: null,
                    message: result.error ?? 'La transferencia fallo.',
                });
            }
        }

        return results;
    }

    private async assertLinkedSubaccount(uuid: string, scope?: CompanyScope): Promise<void> {
        if (!scope?.companyId) return;

        const count = await this.prisma.subCompany.count({
            where: {
                id: scope.subCompanyIds ? { in: scope.subCompanyIds } : undefined,
                companyId: scope.companyId,
                status: Status.active,
                company: { status: Status.active },
                cardcloudSubaccountId: uuid,
            },
        });

        if (count === 0) throw notFound();
    }

    private async findLinkedCardcloudSubaccounts(scope: CompanyScope): Promise<Map<string, LinkedCardcloudSubaccountSummary>> {
        const subCompanies = await this.prisma.subCompany.findMany({
            where: {
                id: scope.subCompanyIds ? { in: scope.subCompanyIds } : undefined,
                companyId: scope.companyId,
                status: Status.active,
                company: { status: Status.active },
                cardcloudSubaccountId: { not: null },
            },
            select: {
                id: true,
                key: true,
                name: true,
                companyId: true,
                cardcloudSubaccountId: true,
            },
        });

        return new Map(
            subCompanies
                .filter((subCompany): subCompany is LinkedCardcloudSubaccount => Boolean(subCompany.cardcloudSubaccountId))
                .map((subCompany) => [
                    subCompany.cardcloudSubaccountId,
                    {
                        id: subCompany.id,
                        key: subCompany.key,
                        name: subCompany.name,
                        companyId: subCompany.companyId,
                    },
                ])
        );
    }

    private filterLinkedSubaccountsResponse(response: CardcloudSubaccountsResponse, linkedSubaccounts: Map<string, LinkedCardcloudSubaccountSummary>): CardcloudVisibleSubaccountsResponse {
        return {
            ...response,
            subaccounts: this.filterLinkedSubaccountsArray(response.subaccounts, linkedSubaccounts),
        };
    }

    private filterLinkedSubaccountsArray(items: CardcloudSubaccount[], linkedSubaccounts: Map<string, LinkedCardcloudSubaccountSummary>): CardcloudVisibleSubaccount[] {
        return items.map((item) => this.withLinkedSubaccount(item, linkedSubaccounts)).filter((item): item is CardcloudVisibleSubaccount => item !== null);
    }

    private withLinkedSubaccount(item: CardcloudSubaccount, linkedSubaccounts: Map<string, LinkedCardcloudSubaccountSummary>): CardcloudVisibleSubaccount | null {
        const subaccountId = this.resolveSubaccountId(item);
        if (!subaccountId) return null;

        const localSubCompany = linkedSubaccounts.get(subaccountId);
        if (!localSubCompany) return null;

        return { ...item, localSubCompany };
    }

    private localSubCompanyLabel(subaccount: CardcloudSubaccount | CardcloudVisibleSubaccount): string {
        if (!('localSubCompany' in subaccount) || !subaccount.localSubCompany) return '-';
        return `${subaccount.localSubCompany.key} - ${subaccount.localSubCompany.name}`;
    }

    private transferBulkExcelResult(row: ParsedTransferBulkExcelRow, status: CardcloudTransferBulkExcelRowStatus, message: string): TransferBulkExcelInternalResult {
        return {
            row: row.row,
            clientId: row.clientId,
            amount: row.amount,
            description: row.description,
            status,
            newBalance: null,
            message,
        };
    }

    private defaultTransferBulkExcelDescription(row: ResolvedTransferBulkExcelRow): string {
        const clientId = row.clientId ? ` ${row.clientId}` : '';
        return row.amount !== null && row.amount < 0 ? `Retiro de saldo de tarjeta${clientId}` : `Abono a tarjeta${clientId}`;
    }

    private parseExcelAmount(value: string): number | null {
        const compact = value.replace(/\s+/g, '').replace(/[^\d,.-]/g, '');
        if (!compact) return null;

        let normalized = compact;
        if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)) {
            normalized = compact.replace(/,/g, '');
        } else if (/^-?\d+,\d+$/.test(compact) && !compact.includes('.')) {
            normalized = compact.replace(',', '.');
        } else {
            normalized = compact.replace(/,/g, '');
        }

        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) return null;

        return Number(parsed.toFixed(2));
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

    private normalizeTransfer(input: TransferCardcloudFundsDto): TransferCardcloudFundsDto {
        const amount = Number(input.amount);
        if (!Number.isFinite(amount) || Math.abs(amount) < 0.01) {
            throw new BadRequestException('El monto debe ser al menos 0.01.');
        }

        if (amount > 0) {
            return { ...input, amount: Number(amount.toFixed(2)) };
        }

        return {
            ...input,
            sourceType: input.destinationType,
            source: input.destination,
            destinationType: input.sourceType,
            destination: input.source,
            amount: Number(Math.abs(amount).toFixed(2)),
        };
    }

    private errorMessage(error: unknown): string {
        if (error instanceof Error) return error.message.slice(0, 500) || 'Error desconocido';
        if (typeof error === 'string') return error.slice(0, 500) || 'Error desconocido';
        return 'Error desconocido';
    }

    private dedupeCards(cards: CardcloudAccountCard[]): { cards: CardcloudAccountCard[]; skipped: number } {
        const uniqueCards = new Map<string, CardcloudAccountCard>();
        let skipped = 0;

        for (const card of cards) {
            const externalId = this.resolveExternalId(card);
            if (!externalId || uniqueCards.has(externalId)) {
                skipped++;
                continue;
            }
            uniqueCards.set(externalId, card);
        }

        return { cards: [...uniqueCards.values()], skipped };
    }

    private async syncChunk(cards: CardcloudAccountCard[]): Promise<{ synced: number; skipped: number }> {
        return this.prisma.$transaction(async (tx) => {
            let synced = 0;
            let skipped = 0;

            for (const card of cards) {
                const externalId = this.resolveExternalId(card);
                if (!externalId) {
                    skipped++;
                    continue;
                }

                const existing = await tx.cardcloud.findUnique({
                    where: { externalId },
                    select: { id: true },
                });

                const data = {
                    maskedPan: this.maskPanKeepingLastFour(card.masked_pan),
                    clientId: card.client_id ?? null,
                    balance: this.encryptBalance(card.balance),
                    providerStatus: this.cleanText(card.status),
                };

                if (existing) {
                    await tx.cardcloud.update({ where: { id: existing.id }, data });
                } else {
                    await tx.cardcloud.create({ data: { externalId, ...data } });
                }
                synced++;
            }

            return { synced, skipped };
        });
    }

    private async resolveCardcloudSubCompanyTarget(subCompanyId: string, scope?: CompanyScope): Promise<CardcloudSubCompanyTarget> {
        const subCompany = await this.prisma.subCompany.findFirst({
            where: {
                AND: [{ id: subCompanyId }, { status: Status.active }, subCompanyScopeWhere(scope)],
            },
            select: {
                id: true,
                cardcloudSubaccountId: true,
            },
        });
        if (!subCompany?.cardcloudSubaccountId) throw invalidRelation();

        return { id: subCompany.id, cardcloudSubaccountId: subCompany.cardcloudSubaccountId };
    }

    private stockScopeWhere(scope: CompanyScope | undefined, includeUnassigned: boolean): Prisma.CardcloudWhereInput {
        if (!scope?.companyId) return {};

        const assignedToScope: Prisma.CardcloudWhereInput = {
            subCompany: {
                ...subCompanyScopeWhere(scope),
                status: Status.active,
            },
        };

        return includeUnassigned ? { OR: [{ subCompanyId: null }, assignedToScope] } : assignedToScope;
    }

    private stockSearch(search: string): Prisma.CardcloudWhereInput[] {
        return [
            { externalId: { contains: search, mode: 'insensitive' } },
            { maskedPan: { contains: search, mode: 'insensitive' } },
            { clientId: { contains: search, mode: 'insensitive' } },
            { providerStatus: { contains: search, mode: 'insensitive' } },
            { subCompany: { key: { contains: search, mode: 'insensitive' } } },
            { subCompany: { name: { contains: search, mode: 'insensitive' } } },
        ];
    }

    private buildStockWhere(dto: FindCardcloudStockDto, scope?: CompanyScope): Prisma.CardcloudWhereInput {
        return {
            AND: [
                this.stockScopeWhere(scope, true),
                {
                    subCompanyId: dto.subCompanyId,
                    providerStatus: dto.providerStatus,
                    ...(dto.search ? { OR: this.stockSearch(dto.search) } : {}),
                },
            ],
        };
    }

    private formatCardAssignmentMode(mode: CardAssignmentMode | null | undefined): string {
        if (mode === CardAssignmentMode.vehicle) return 'Vehiculo';
        if (mode === CardAssignmentMode.unassigned) return 'Sin asignar';
        return '-';
    }

    private async findLocalStock(id: string, scope?: CompanyScope): Promise<CardcloudStockResponse> {
        const stock = await this.prisma.cardcloud.findFirst({
            where: {
                AND: [{ id }, this.stockScopeWhere(scope, true)],
            },
            select: this.localStockSelect(),
        });
        if (!stock) throw notFound();
        return this.serializeLocalStock(stock);
    }

    private async findAssignableLocalStock(id: string, scope?: CompanyScope): Promise<AssignableLocalStockRecord> {
        const stock = await this.prisma.cardcloud.findFirst({
            where: {
                AND: [{ id }, this.stockScopeWhere(scope, true)],
            },
            select: ASSIGNABLE_LOCAL_STOCK_SELECT,
        });
        if (!stock) throw notFound();
        return stock;
    }

    private async assignExternalCardToSubaccount(cardId: string, subaccountId: string): Promise<CardcloudExternalAssignmentResult> {
        try {
            await this.external.post<CardcloudAssignCardsResponse>('/v1/account/cards/assign_bulk', {
                subaccount_id: subaccountId,
                cards: [cardId],
            });
            return 'assigned';
        } catch (error) {
            const alreadyAssigned = await this.isExternalCardInSubaccount(cardId, subaccountId);
            if (alreadyAssigned) return 'already_assigned';
            throw this.cardcloudAssignmentRejected(error);
        }
    }

    private async isExternalCardInSubaccount(cardId: string, subaccountId: string): Promise<boolean> {
        try {
            const card = await this.external.get<CardcloudCardDetail>(`/v1/card/${cardId}`);
            return card.subaccount_id === subaccountId;
        } catch {
            return false;
        }
    }

    private cardcloudAssignmentRejected(error: unknown): BadRequestException | I18nHttpException {
        const status = this.resolveExternalStatus(error);
        const detail = this.resolveExternalErrorMessage(error);

        if (status !== null && status >= 400 && status < 500) {
            return new BadRequestException({
                message: detail ? `Cardcloud rechazo la asignacion: ${detail}` : 'Cardcloud rechazo la asignacion de la tarjeta a la subcuenta destino.',
                reason: 'cardcloud_assignment_rejected',
            });
        }

        return new I18nHttpException(HttpStatus.BAD_GATEWAY, I18N_KEYS.errors.internal.unprocessed, 'No pudimos completar la operacion con el servicio externo. Intenta mas tarde.', {
            extra: { reason: 'cardcloud_assignment_failed' },
        });
    }

    private resolveExternalStatus(error: unknown): number | null {
        const response = this.resolveExternalResponse(error);
        return typeof response?.status === 'number' ? response.status : null;
    }

    private resolveExternalErrorMessage(error: unknown): string | null {
        const data = this.resolveExternalResponse(error)?.data;
        const direct = this.extractExternalErrorMessage(data);
        if (direct) return direct;

        if (error instanceof Error && error.message && !error.message.includes('status code')) return error.message.slice(0, 300);
        return null;
    }

    private extractExternalErrorMessage(value: unknown): string | null {
        if (typeof value === 'string') return value.slice(0, 300);
        if (!this.isRecord(value)) return null;

        const direct = this.extractStringField(value, ['message', 'error', 'detail', 'reason']);
        if (direct) return direct.slice(0, 300);

        const errors = value.errors;
        if (Array.isArray(errors)) {
            const messages = errors
                .map((entry) => (typeof entry === 'string' ? entry : this.extractStringField(entry, ['message', 'error', 'detail', 'reason'])))
                .filter((entry): entry is string => Boolean(entry));
            if (messages.length > 0) return messages.join('; ').slice(0, 300);
        }

        return null;
    }

    private resolveExternalResponse(error: unknown): { status?: unknown; data?: unknown } | null {
        if (!this.isRecord(error)) return null;
        const response = error.response;
        if (!this.isRecord(response)) return null;
        return response;
    }

    private localStockSelect(): Prisma.CardcloudSelect {
        return LOCAL_STOCK_SELECT;
    }

    private serializeLocalStock(stock: LocalStockRecord): CardcloudStockResponse {
        return {
            ...stock,
            maskedPan: this.maskPanKeepingLastFour(stock.maskedPan),
            balance: this.decryptBalance(stock.balance),
        };
    }

    private async fetchAllFromCardcloud(): Promise<CardcloudAccountCard[]> {
        const first = await this.external.get<CardcloudAccountCardsResponse>('/v1/account/cards', { page: 1 });
        const all = [...first.cards];
        const totalPages = first.total_pages;

        for (let start = 2; start <= totalPages; start += PAGE_BATCH_SIZE) {
            const end = Math.min(start + PAGE_BATCH_SIZE - 1, totalPages);
            const pages = Array.from({ length: end - start + 1 }, (_value, index) => start + index);
            const results = await Promise.all(pages.map((page) => this.external.get<CardcloudAccountCardsResponse>('/v1/account/cards', { page })));
            for (const result of results) all.push(...result.cards);
            if (end < totalPages) await new Promise((resolve) => setTimeout(resolve, PAGE_BATCH_DELAY_MS));
        }

        return all;
    }

    private resolveExternalId(card: CardcloudAccountCard): string | null {
        return this.cleanText(card.card_id);
    }

    private resolveSubaccountId(response: unknown): string | null {
        const direct = this.extractStringField(response, ['subaccount_id', 'uuid', 'id']);
        if (direct) return direct;

        if (!this.isRecord(response)) return null;

        return this.resolveSubaccountId(response.data) ?? this.resolveSubaccountId(response.subaccount);
    }

    private extractStringField(value: unknown, fields: string[]): string | null {
        if (!this.isRecord(value)) return null;

        for (const field of fields) {
            const fieldValue = value[field];
            if (typeof fieldValue === 'string' && fieldValue.trim()) return fieldValue.trim();
        }

        return null;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    private cleanText(value?: string | null): string | null {
        const clean = value?.trim();
        return clean || null;
    }

    private maskPanKeepingLastFour(value?: string | null): string | null {
        const token = value?.replace(/[^0-9Xx]/g, '');
        const digits = token?.replace(/\D/g, '');
        if (!digits) return null;
        const lastFour = digits.slice(-4);
        const maskedLength = Math.max((token?.length ?? 0) - lastFour.length, 12);
        return `${'X'.repeat(maskedLength)}${lastFour}`;
    }

    private encryptBalance(value?: string | number | null): string | null {
        const normalized = this.normalizeBalance(value);
        return normalized ? this.cryptoService.encrypt(normalized) : null;
    }

    private decryptBalance(value?: string | Prisma.Decimal | null): string | null {
        if (value === null || value === undefined) return null;
        const plaintext = this.cryptoService.decrypt(String(value)) ?? String(value);
        return this.normalizeBalance(plaintext);
    }

    private normalizeBalance(value?: string | number | Prisma.Decimal | null): string | null {
        if (value === null || value === undefined || value === '') return null;
        try {
            return new Prisma.Decimal(String(value).replace(/,/g, '').trim()).toFixed(2);
        } catch {
            return null;
        }
    }
}
