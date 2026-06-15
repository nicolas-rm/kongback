# Kong Backend Base

Backend base en NestJS con Prisma, autenticación, control de acceso, documentos, notificaciones, mailer y estructura preparada para próximos proyectos.

## Requisitos

- Node.js compatible con NestJS 11
- pnpm
- PostgreSQL

## Instalación

```bash
pnpm install
```

## Variables De Entorno

Configura `.env` con:

- `DATABASE_URL`
- `DIRECT_URL`
- `APP_NAME`
- `APP_WEB_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `MAIL_FROM`
- `ENCRYPTION_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_FULL_NAME`

La validación vive en `src/configurations/env.validation.ts`.

## Base De Datos

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

## Desarrollo

```bash
pnpm start:dev
```

Endpoints útiles:

- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/docs`

## Verificación

```bash
pnpm build
pnpm test
pnpm test:e2e
pnpm prisma:generate
```

## Estructura

```txt
src/
  configurations/
  crypto/
  decorators/
  errors/
  filters/
  guards/
  mailer/
  modules/
    access-control/
    authentication/
    documents/
    health/
    integrations/
    notifications/
    scheduler/
    users/
  prisma/
  utilities/
```

## Convenciones

- `Dto` valida entrada.
- `Repository` consulta datos y usa `select`.
- `Service` o `UseCase` aplica lógica y transforma salidas.
- `Response` define contratos públicos de API.
- Listados paginados usan `{ data, meta }`.
- Acciones usan respuestas simples.
- Errores usan `statusCode`, `code`, `message`, `path`, `timestamp`.

Ver más en `docs/standards/project-standard.md`.

## Producto Vinka

La propuesta de producto para convertir esta base en una plataforma SaaS de links de pago con Stripe esta documentada en `docs/product/vinka-payment-links-platform.md`.

## Ideas De Producto

El portafolio de ideas SaaS que podrian construirse con esta base esta documentado en `docs/product/business-ideas-portfolio.md`.
