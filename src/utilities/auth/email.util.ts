export function normalizeEmail(email: string | null | undefined): string | null {
    const value = email?.trim().toLowerCase();
    return value && value.length > 0 ? value : null;
}
