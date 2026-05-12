export type PermissionSeed = {
    code: string;
    name: string;
    description: string;
};

export const PERMISSION_CATALOG = [
    { code: 'organizations.create', name: 'Crear organización', description: 'Permite crear una organización.' },
    { code: 'organizations.read-list', name: 'Listar organizaciones', description: 'Permite consultar el listado de organizaciones.' },
    { code: 'organizations.read-one', name: 'Ver organización', description: 'Permite consultar el detalle de una organización.' },
    { code: 'organizations.update', name: 'Actualizar organización', description: 'Permite actualizar una organización.' },
    { code: 'organizations.delete', name: 'Eliminar organización', description: 'Permite eliminar una organización.' },
    { code: 'organizations.members.read', name: 'Listar miembros de organización', description: 'Permite consultar los miembros de una organización.' },
    { code: 'organizations.members.add', name: 'Agregar miembro a organización', description: 'Permite agregar miembros a una organización.' },
    { code: 'organizations.members.remove', name: 'Remover miembro de organización', description: 'Permite remover miembros de una organización.' },
    { code: 'users.create', name: 'Crear usuario', description: 'Permite crear un usuario desde el endpoint administrativo.' },
    { code: 'users.read-list', name: 'Listar usuarios', description: 'Permite consultar el listado de usuarios.' },
    { code: 'users.read-one', name: 'Ver usuario', description: 'Permite consultar el detalle de un usuario.' },
    { code: 'users.update', name: 'Actualizar usuario', description: 'Permite actualizar los datos de un usuario.' },
    { code: 'users.delete', name: 'Eliminar usuario', description: 'Permite eliminar un usuario.' },
    { code: 'users.access.assign', name: 'Asignar accesos a usuario', description: 'Permite asignar roles y scopes a un usuario.' },
    { code: 'users.access.read', name: 'Ver accesos de usuario', description: 'Permite consultar los accesos asignados a un usuario.' },
    { code: 'users.permissions.read', name: 'Ver permisos de usuario', description: 'Permite consultar los permisos efectivos de un usuario.' },
    { code: 'users.password.update', name: 'Cambiar contraseña de usuario', description: 'Permite cambiar la contraseña de un usuario.' },
    { code: 'users.2fa.unlink', name: 'Desvincular 2FA de usuario', description: 'Permite desvincular la configuración 2FA de un usuario.' },
    { code: 'users.credentials.resend', name: 'Reenviar credenciales de usuario', description: 'Permite regenerar y reenviar credenciales de acceso a un usuario.' },
    { code: 'roles.create', name: 'Crear rol', description: 'Permite crear un rol.' },
    { code: 'roles.read-list', name: 'Listar roles', description: 'Permite consultar el listado de roles.' },
    { code: 'roles.read-one', name: 'Ver rol', description: 'Permite consultar el detalle de un rol.' },
    { code: 'roles.update', name: 'Actualizar rol', description: 'Permite actualizar un rol.' },
    { code: 'roles.delete', name: 'Eliminar rol', description: 'Permite eliminar un rol.' },
    { code: 'roles.permissions.assign', name: 'Asignar permisos a rol', description: 'Permite asignar o sincronizar permisos en un rol.' },
    { code: 'roles.permissions.read', name: 'Ver permisos de rol', description: 'Permite consultar los permisos asignados a un rol.' },
    { code: 'permissions.create', name: 'Crear permiso', description: 'Permite crear un permiso.' },
    { code: 'permissions.read-list', name: 'Listar permisos', description: 'Permite consultar el listado de permisos.' },
    { code: 'permissions.read-one', name: 'Ver permiso', description: 'Permite consultar el detalle de un permiso.' },
    { code: 'permissions.update', name: 'Actualizar permiso', description: 'Permite actualizar un permiso.' },
    { code: 'permissions.delete', name: 'Eliminar permiso', description: 'Permite eliminar un permiso.' },
    { code: 'documents.create', name: 'Crear documento', description: 'Permite cargar un documento.' },
    { code: 'documents.read-list', name: 'Listar documentos', description: 'Permite consultar el listado de documentos.' },
    { code: 'documents.read-one', name: 'Ver documento', description: 'Permite consultar el detalle de un documento.' },
    { code: 'documents.download', name: 'Descargar documento', description: 'Permite descargar un documento.' },
    { code: 'documents.update', name: 'Actualizar documento', description: 'Permite actualizar los metadatos de un documento.' },
    { code: 'documents.delete', name: 'Eliminar documento', description: 'Permite eliminar un documento.' },
    { code: 'notifications.create', name: 'Crear notificación', description: 'Permite crear una notificación.' },
    { code: 'notifications.read-list', name: 'Listar notificaciones', description: 'Permite consultar la bandeja de notificaciones.' },
    { code: 'notifications.unread-count.read', name: 'Ver contador de no leídas', description: 'Permite consultar el contador de notificaciones no leídas.' },
    { code: 'notifications.mark-read', name: 'Marcar notificación como leída', description: 'Permite marcar una notificación como leída.' },
    { code: 'notifications.mark-read-all', name: 'Marcar todas las notificaciones como leídas', description: 'Permite marcar todas las notificaciones como leídas.' },
] as const satisfies PermissionSeed[];

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]['code'];

export const ALL_PERMISSION_CODES = PERMISSION_CATALOG.map((permission) => permission.code);
