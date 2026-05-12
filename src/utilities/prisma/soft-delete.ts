export function activeRecordWhere<T extends object>(where: T): T & { deletedAt: null } {
    return { ...where, deletedAt: null };
}

export function softDeleteData(userId?: string | null) {
    return {
        deletedAt: new Date(),
        ...(userId !== undefined ? { deletedByUserId: userId } : {}),
    };
}
