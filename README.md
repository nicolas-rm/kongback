# Kong Back

Backend NestJS para la operacion de autenticacion, usuarios, permisos, empresas, tarjetas, documentos, notificaciones y servicios relacionados con Cardcloud.

## Stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Socket.IO
- JWT con cookies HttpOnly
- i18n para errores y validaciones

## Modulos principales

- Autenticacion, sesiones, recuperacion de contrasena y 2FA.
- Usuarios, roles, permisos y accesos por empresa.
- Empresas, subempresas, conductores, vehiculos, combustibles, estaciones y tarjetas.
- Cardcloud, stock Cardcloud y operaciones de tarjetas externas.
- Portal de tarjetahabiente.
- Documentos y almacenamiento local de archivos.
- Notificaciones REST y realtime.
- Auditoria tecnica, seguridad, accesos y eventos operativos.
- Health check.

## Requisitos

- Node.js compatible con NestJS 12.
- pnpm.
- PostgreSQL.

## Configuracion

Copia el archivo de ejemplo y ajusta los valores locales:

```bash
cp .env.example .env
```

Variables principales:

- `DATABASE_URL`: conexion PostgreSQL usada por la aplicacion.
- `DIRECT_URL`: conexion directa usada por Prisma para migraciones.
- `PORT`: puerto HTTP del backend.
- `APP_NAME`: nombre mostrado en correos y 2FA.
- `APP_WEB_URL`: URL del frontend permitida por CORS.
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`: secretos para tokens.
- `ENCRYPTION_KEY`: clave AES-256-GCM de 64 caracteres hexadecimales.
- `MAIL_*`: configuracion de correo.
- `CARDCLOUD_*`: credenciales y URL de Cardcloud.
- `ADMIN_*`: usuario administrador inicial para seed.

## Instalacion

```bash
pnpm install
```

## Base de datos

Generar cliente Prisma:

```bash
pnpm prisma:generate
```

Crear o aplicar migraciones en desarrollo:

```bash
pnpm prisma:migrate
```

Ejecutar seed:

```bash
pnpm prisma:seed
```

Seeds alternativos:

```bash
pnpm prisma:seed:minimal
pnpm prisma:seed:basic
pnpm prisma:seed:medium
```

## Desarrollo

```bash
pnpm dev
```

Endpoints base:

- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`

## Produccion

```bash
pnpm build
pnpm prod
```

## Calidad

```bash
pnpm format
pnpm lint
```
