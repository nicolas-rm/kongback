import type { CardAssignmentMode, Status } from '@prisma/client';

export const CARDCLOUD_TRANSFER_ENTITY_TYPES = ['account', 'subaccount', 'card'] as const;

export type CardcloudTransferEntityType = (typeof CARDCLOUD_TRANSFER_ENTITY_TYPES)[number];

export type CardcloudTransferBulkExcelRowStatus = 'succeeded' | 'failed' | 'omitted';

export type CardcloudProviderPageValue = string | number;

export interface CardcloudMovementCardReference {
    card_id: string | null;
    masked_pan: string | null;
    bin?: string | null;
    client_id?: string | null;
}

export interface CardcloudAccountMovement {
    movement_id: string;
    card: CardcloudMovementCardReference;
    type: string;
    description: string;
    reference: string;
    amount: string | number;
    balance: string | number;
    date: string | number;
}

export interface CardcloudAccountLastMovement extends CardcloudAccountMovement {}

export interface CardcloudAccountWallet {
    wallet_id: string;
    balance: string | number;
    clabe: string | null;
    last_movements: CardcloudAccountLastMovement[];
}

export interface CardcloudAccountResponse {
    account: string;
    wallet: CardcloudAccountWallet;
}

export interface CardcloudAccountMovementsResponse {
    movements: CardcloudAccountMovement[];
}

export interface CardcloudCardDollarBalance {
    balance: string;
    exchange_rate: string;
    exchange_rate_date: string;
}

export interface CardcloudCardSubstatus {
    id: number;
    name: string;
    description: string;
}

export interface CardcloudCardSetups {
    Id?: number;
    CardId?: number;
    Status?: string;
    StatusReason?: string;
    Ecommerce: number;
    International: number;
    Stripe: number;
    Wallet: number;
    Withdrawal: number;
    Contactless: number;
    PinOffline: number;
    PinOnUs: number;
}

export interface CardcloudCardDetail {
    card_id: string;
    card_external_id: string;
    card_type: string;
    brand: string;
    bin: string;
    pan: string;
    client_id: string;
    masked_pan: string;
    balance: string;
    dollar_balance: CardcloudCardDollarBalance;
    clabe: string | null;
    status: string;
    substatus?: CardcloudCardSubstatus;
    setups: CardcloudCardSetups;
    subaccount_id: string | null;
}

export interface CardcloudCardMovement {
    movement_id: string;
    date: number;
    type: string;
    amount: string | number;
    balance: string | number;
    authorization_code: string;
    description: string;
    status: string;
}

export interface CardcloudCardMovementsResponse {
    movements: CardcloudCardMovement[];
    total_records: CardcloudProviderPageValue;
    from: CardcloudProviderPageValue;
    to: CardcloudProviderPageValue;
}

export interface CardcloudCardMovementDetail extends CardcloudCardMovement {
    client_id: string;
}

export interface CardcloudCardSensitiveDataRaw {
    pan: string;
    expiration_date: string;
    pin: string;
}

export interface CardcloudCardSensitiveDataResponse {
    sensitive_data: string;
    sensitive_data_raw: CardcloudCardSensitiveDataRaw;
}

export interface CardcloudCardCvvResponse {
    cvv: string;
    expiration: string;
}

export interface CardcloudUpdateCardNipResponse {
    message: string;
}

export interface CardcloudValidateCardResponse {
    card_id: string;
}

export interface CardcloudCardStatusChangeResponse {
    message: string;
    card: CardcloudCardDetail;
}

export interface CardcloudAssignedCard {
    card_id: string;
    card_type: string;
    brand: string;
    masked_pan: string;
    bin: string;
    balance: string;
    clabe: string | null;
    status: string;
}

export interface CardcloudAssignCardsResponse {
    cards: CardcloudAssignedCard[];
    page: CardcloudProviderPageValue;
    total_pages: CardcloudProviderPageValue;
    total_records: CardcloudProviderPageValue;
}

export interface CardcloudSubaccountWallet {
    wallet_id: string;
    balance: string | number;
    clabe: string | null;
    last_movements: CardcloudSubaccountLastMovement[];
}

export interface CardcloudSubaccountLastMovement {
    movement_order?: number;
    movement_id: string;
    card: CardcloudMovementCardReference;
    type: string;
    description: string;
    reference?: string;
    amount: string | number;
    balance: string | number;
    geolocation?: string | null;
    approver?: string | null;
    date: string | number;
}

export interface CardcloudSubaccount {
    subaccount_id: string;
    external_id: string;
    description: string;
    wallet: CardcloudSubaccountWallet;
    page?: CardcloudProviderPageValue;
    total_pages?: CardcloudProviderPageValue;
    total_records?: CardcloudProviderPageValue;
}

export interface CardcloudSubaccountsResponse {
    subaccounts: CardcloudSubaccount[];
}

export interface CardcloudLocalSubCompanySummary {
    id: string;
    key: string;
    name: string;
    companyId: string;
}

export type CardcloudVisibleSubaccount = CardcloudSubaccount & {
    localSubCompany?: CardcloudLocalSubCompanySummary;
};

export interface CardcloudVisibleSubaccountsResponse {
    subaccounts: CardcloudVisibleSubaccount[];
}

export interface CardcloudSubaccountDetail {
    subaccount_id: string;
    external_id: string;
    description: string;
    wallet: CardcloudSubaccountWallet;
}

export interface CardcloudSubaccountCard {
    card_id: string;
    card_external_id: string;
    card_type: string;
    brand: string;
    bin: string;
    pan: string;
    client_id: string;
    masked_pan: string;
    balance: string;
    clabe: string | null;
    status: string;
    setups: CardcloudCardSetups;
}

export interface CardcloudSubaccountCardsResponse {
    cards: CardcloudSubaccountCard[];
    page: number;
    total_pages: number;
    total_records: number;
}

export interface CardcloudSubaccountMovement {
    movement_id: string;
    type: string;
    description: string;
    reference: string;
    amount: string | number;
    balance: string | number;
    authorization_code: string;
    date: string | number;
    card: CardcloudMovementCardReference;
}

export interface CardcloudSubaccountMovementsResponse {
    movements: CardcloudSubaccountMovement[];
    total_records: CardcloudProviderPageValue;
    from: CardcloudProviderPageValue;
    to: CardcloudProviderPageValue;
}

export interface CardcloudCreatedSubaccount {
    subaccount_id: string;
    external_id: string;
    description: string;
}

export interface CardcloudTransferFundsResponse {
    new_balance: string;
    movement: {
        movement_order: number;
        movement_id: string;
        type: string;
        description: string;
        reference: string;
        amount: number;
        balance: number;
        geolocation: string | null;
        approver: string | null;
        date: number;
        card: CardcloudMovementCardReference;
    };
}

export interface CardcloudTransferFundsBulkItemResult {
    index: number;
    success: boolean;
    data?: CardcloudTransferFundsResponse;
    error?: string;
}

export interface CardcloudTransferFundsBulkResponse {
    results: CardcloudTransferFundsBulkItemResult[];
    summary: {
        total: number;
        succeeded: number;
        failed: number;
    };
}

export interface CardcloudTransferBulkExcelRowResult {
    row: number;
    clientId: string | null;
    amount: number | null;
    description: string | null;
    status: CardcloudTransferBulkExcelRowStatus;
    newBalance: string | null;
    message: string;
}

export interface CardcloudTransferFundsBulkExcelResponse {
    subCompanyId: string;
    results: CardcloudTransferBulkExcelRowResult[];
    summary: {
        totalRows: number;
        prepared: number;
        succeeded: number;
        failed: number;
        omitted: number;
    };
}

export interface CardcloudTransferBulkExcelTemplateResponse {
    filename: string;
    mimeType: string;
    buffer: Buffer;
}

export interface SyncCardcloudStockResult {
    synced: number;
    skipped: number;
    removed: number;
}

export interface CardcloudAccountCard {
    card_id?: string | null;
    card_external_id?: string | null;
    card_type?: string | null;
    brand?: string | null;
    bin?: string | null;
    pan?: string | null;
    client_id?: string | null;
    masked_pan?: string | null;
    balance?: string | number | null;
    clabe?: string | null;
    status?: string | null;
    subaccount_id?: string | null;
}

export interface CardcloudAccountCardsResponse {
    cards: CardcloudAccountCard[];
    page: number;
    total_pages: number;
    total_records: number;
}

export interface CardcloudStockSummaryResponse {
    id: string;
    externalId: string;
    subCompanyId: string | null;
    assignedCardId: string | null;
    maskedPan: string | null;
    clientId: string | null;
    balance: string | null;
    providerStatus: string | null;
}

export interface CardcloudStockResponse extends CardcloudStockSummaryResponse {
    assignedCard: {
        id: string;
        assignmentMode: CardAssignmentMode;
        status: Status;
    } | null;
    subCompany: {
        id: string;
        companyId: string;
        key: string;
        name: string;
    } | null;
}
