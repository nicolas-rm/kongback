const CARDHOLDER_ROLE_CODES = new Set(['tarjetahabiente', 'cardholder']);
const CARDHOLDER_PERMISSION_PREFIX = 'cardholder.';
const CARDHOLDER_NEUTRAL_PERMISSION_CODES = new Set([
    'notifications.module',
    'notifications.read-list',
    'notifications.unread-count.read',
    'notifications.mark-read',
    'notifications.mark-read-all',
]);

export function isCardholderRoleCode(code: string): boolean {
    return CARDHOLDER_ROLE_CODES.has(code);
}

export function isCardholderPermissionCode(code: string): boolean {
    return code.startsWith(CARDHOLDER_PERMISSION_PREFIX);
}

export function isAdministrativePermissionForCardholder(code: string): boolean {
    return !isCardholderPermissionCode(code) && !CARDHOLDER_NEUTRAL_PERMISSION_CODES.has(code);
}
