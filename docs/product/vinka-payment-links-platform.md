# Vinka - Plataforma De Links De Pago Con Stripe

## Objetivo

Vinka es una plataforma SaaS para que negocios puedan generar links de pago, compartirlos por WhatsApp, correo o QR, y administrar sus cobros desde un panel propio.

El producto no debe presentarse como una pasarela de pagos. Stripe procesa los pagos. Vinka organiza la cobranza, clientes, estados, reportes, facturacion, recordatorios, usuarios, permisos, marca del negocio y auditoria.

Frase base:

```txt
Cobra facil por link.
```

## Posicionamiento

Vinka debe venderse como:

```txt
Sistema de cobranza con links de pago para negocios.
```

No como:

```txt
Otra pasarela de pagos.
```

Stripe resuelve el pago seguro, onboarding financiero, tarjetas, metodos de pago, identidad, cuentas conectadas, payouts, recibos basicos y webhooks. Vinka construye la experiencia operativa alrededor de eso.

## Problema Que Resuelve

Muchos negocios cobran por WhatsApp, transferencia, deposito o links sueltos, pero no tienen control real de:

- Quien pago.
- Quien debe.
- Que links estan activos.
- Que pagos vencieron.
- Que clientes tienen adeudos.
- Que facturas faltan.
- Cuanto se cobro en el mes.
- Que vendedor genero cada cobro.
- Que pagos fallaron.
- Que pagos fueron reembolsados.

Vinka centraliza esa operacion.

## Usuarios Objetivo

El producto apunta a negocios que cobran servicios, anticipos, mensualidades o pagos unicos:

- Clinicas.
- Escuelas.
- Despachos.
- Talleres.
- Inmobiliarias.
- Cursos.
- Freelancers.
- Agencias.
- Servicios profesionales.
- Proveedores B2B.
- Consultorios.
- Academias.

## Base Tecnica Actual

Este backend ya puede usarse como base porque incluye:

- NestJS.
- Prisma.
- PostgreSQL.
- Autenticacion.
- Refresh sessions.
- 2FA.
- Usuarios.
- Roles y permisos base.
- Mailer.
- i18n.
- Errores estandarizados.
- Seguridad HTTP, CORS y throttling.
- Healthcheck.
- Estructura modular.

La estrategia recomendada es adaptar este backend, no empezar otro desde cero.

## Cambio Arquitectonico Principal

El backend debe pasar de una base general a un SaaS multi-negocio.

El usuario no debe representar al negocio directamente. La relacion recomendada es:

```txt
User -> Membership -> Business
```

Esto permite:

- Un usuario en uno o varios negocios.
- Roles distintos por negocio.
- Permisos por negocio.
- Datos aislados por `businessId`.
- Operacion SaaS real.

Toda entidad del producto debe quedar asociada al negocio correspondiente.

## Dominios Principales

Los dominios base del producto son:

- `Business`: negocio que usa la plataforma.
- `Membership`: relacion usuario-negocio.
- `Customer`: cliente final del negocio.
- `PaymentOrder`: cobro interno.
- `PaymentLink`: link publico de pago.
- `Payment`: pago confirmado o fallido.
- `StripeAccount`: cuenta conectada de Stripe.
- `Invoice`: factura fiscal o solicitud de factura.
- `Receipt`: recibo simple propio.
- `Payout`: deposito reportado por Stripe.
- `Reminder`: recordatorio de pago.
- `AuditLog`: auditoria de acciones importantes.
- `BusinessSettings`: configuracion del negocio.
- `ApiKey`: llaves para integraciones futuras.
- `File`: archivos subidos o generados.
- `Notification`: notificaciones internas o por correo.

## Modulos Backend Recomendados

Los modulos del producto deberian vivir en `src/modules`:

```txt
src/modules/businesses
src/modules/customers
src/modules/payment-orders
src/modules/payment-links
src/modules/payments
src/modules/stripe
src/modules/invoices
src/modules/receipts
src/modules/reports
src/modules/deposits
src/modules/reminders
src/modules/audit
src/modules/settings
src/modules/files
src/modules/notifications
src/modules/api-keys
```

Los componentes transversales deben mantenerse fuera de `modules`:

```txt
src/configurations
src/crypto
src/decorators
src/errors
src/filters
src/guards
src/i18n
src/mailer
src/prisma
src/security
src/storage
src/utilities
```

## Stripe

Para este producto se recomienda usar Stripe Connect con Checkout Sessions.

### Por Que Stripe Connect

Stripe Connect permite que cada negocio conecte su propia cuenta Stripe Express. Stripe maneja onboarding, validacion de identidad, datos bancarios, capacidad de recibir cargos, capacidad de recibir depositos y dashboard Express.

Vinka mantiene:

- Clientes internos.
- Cobros.
- Links de pago.
- Estados propios.
- Reportes.
- Recibos.
- Facturacion CFDI futura.
- Recordatorios.
- Auditoria.
- Permisos.
- Branding.

### Flujo Stripe Recomendado

```txt
Negocio conecta Stripe
Backend crea cuenta conectada
Stripe devuelve onboarding link
Usuario completa onboarding en Stripe
Stripe manda account.updated
Backend actualiza estado de StripeAccount
Negocio ya puede generar cobros si charges_enabled es true
```

Para pagos:

```txt
Cliente abre link publico
Frontend pide resumen del link al backend
Cliente presiona pagar
Backend crea Checkout Session en Stripe
Frontend redirige a Stripe Checkout
Cliente paga en Stripe
Stripe redirige a success/cancel
Stripe manda webhook
Backend confirma pago real desde webhook
Backend actualiza Payment, PaymentOrder y PaymentLink
Backend envia notificaciones o recibos
```

Regla importante:

```txt
Nunca marcar un pago como pagado solo porque el cliente llego a success.
El pago real se confirma con webhooks de Stripe.
```

## Flujo General Del Producto

### Registro

```txt
Usuario se registra
Backend crea User
Backend crea Business
Backend crea Membership con rol OWNER
Backend crea configuracion inicial del negocio
Backend inicia checklist de onboarding
```

### Onboarding

Checklist recomendado:

- Completar perfil del negocio.
- Subir logo.
- Conectar Stripe.
- Crear primer cliente.
- Crear primer link de pago.
- Probar link de pago.
- Configurar datos fiscales.

Cada paso debe tener estado pendiente/completo, descripcion corta y accion para continuar.

### Crear Link De Pago

```txt
Usuario entra al dashboard
Selecciona Crear cobro
Selecciona o crea cliente
Captura concepto, monto, moneda y vencimiento
Backend crea PaymentOrder
Backend crea PaymentLink con slug unico
Usuario copia, envia o descarga QR
Cliente abre link publico
```

### Cliente Paga

```txt
Cliente abre /pay/[slug]
Ve resumen del cobro
Presiona Pagar ahora
Backend crea Checkout Session
Stripe procesa el pago
Cliente vuelve a /pay/[slug]/success o /pay/[slug]/cancel
Webhook confirma el resultado real
Backend actualiza estados
```

### Cliente Solicita Factura

```txt
Cliente paga
Cliente abre solicitud de factura
Captura datos fiscales
Backend registra solicitud
Proveedor CFDI emite factura
Backend guarda PDF/XML/UUID
Cliente descarga documentos
```

La facturacion CFDI debe integrarse despues con un proveedor externo como Facturapi, Facturama, SW Sapien, Finkok, FacturaDigital o Alegra.

## Estados Del Sistema

### Business

```txt
ACTIVE
INACTIVE
SUSPENDED
PENDING_STRIPE
STRIPE_REVIEW
```

### StripeAccount

```txt
NOT_CONNECTED
ONBOARDING_PENDING
ACTIVE
RESTRICTED
DISABLED
```

### PaymentOrder

```txt
DRAFT
PENDING
PAID
PARTIALLY_PAID
EXPIRED
CANCELED
FAILED
REFUNDED
DISPUTED
```

### PaymentLink

```txt
ACTIVE
PAID
EXPIRED
CANCELED
DISABLED
```

### Payment

```txt
PENDING
SUCCEEDED
FAILED
REFUNDED
PARTIALLY_REFUNDED
DISPUTED
```

### Invoice

```txt
NOT_REQUESTED
REQUESTED
ISSUED
FAILED
CANCELED
```

## Modelo De Datos Inicial

El primer schema Prisma deberia cubrir como minimo:

```txt
Business
Membership
BusinessSettings
Customer
PaymentOrder
PaymentLink
Payment
StripeAccount
Invoice
Receipt
AuditLog
```

### Campos Base Sugeridos

`Business`:

- `id`
- `name`
- `legalName`
- `slug`
- `email`
- `phone`
- `country`
- `currency`
- `timezone`
- `status`
- `createdAt`
- `updatedAt`
- `deletedAt`

`Membership`:

- `id`
- `userId`
- `businessId`
- `roleId`
- `status`
- `createdAt`
- `updatedAt`

`Customer`:

- `id`
- `businessId`
- `name`
- `email`
- `phone`
- `company`
- `taxId`
- `legalName`
- `fiscalZipCode`
- `taxRegime`
- `cfdiUse`
- `billingEmail`
- `notes`
- `status`
- `createdAt`
- `updatedAt`
- `deletedAt`

`PaymentOrder`:

- `id`
- `businessId`
- `customerId`
- `folio`
- `concept`
- `description`
- `amount`
- `currency`
- `status`
- `dueDate`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `deletedAt`

`PaymentLink`:

- `id`
- `businessId`
- `paymentOrderId`
- `slug`
- `status`
- `expiresAt`
- `openedCount`
- `paidCount`
- `createdAt`
- `updatedAt`
- `disabledAt`

`Payment`:

- `id`
- `businessId`
- `paymentOrderId`
- `customerId`
- `stripePaymentIntentId`
- `stripeCheckoutSessionId`
- `amount`
- `currency`
- `status`
- `method`
- `paidAt`
- `createdAt`
- `updatedAt`

`StripeAccount`:

- `id`
- `businessId`
- `stripeAccountId`
- `status`
- `chargesEnabled`
- `payoutsEnabled`
- `detailsSubmitted`
- `requirements`
- `lastSyncedAt`
- `createdAt`
- `updatedAt`

`Invoice`:

- `id`
- `businessId`
- `paymentId`
- `customerId`
- `status`
- `uuid`
- `pdfUrl`
- `xmlUrl`
- `requestedAt`
- `issuedAt`
- `createdAt`
- `updatedAt`

`AuditLog`:

- `id`
- `businessId`
- `userId`
- `action`
- `entity`
- `entityId`
- `ip`
- `metadata`
- `createdAt`

## Permisos Sugeridos

Permisos iniciales:

```txt
customers.create
customers.read
customers.update
customers.delete

payment-orders.create
payment-orders.read
payment-orders.update
payment-orders.cancel

payment-links.create
payment-links.read
payment-links.disable

payments.read
payments.refund

invoices.create
invoices.read
invoices.cancel

reports.read
settings.update
users.invite
stripe.connect
audit.read
```

Roles sugeridos:

- Owner.
- Administrator.
- Seller.
- Accountant.
- Read Only.
- Support.

## Endpoints Iniciales Recomendados

### Businesses

```txt
GET /api/businesses/current
PATCH /api/businesses/current
PATCH /api/businesses/current/branding
GET /api/businesses/current/onboarding
PATCH /api/businesses/current/onboarding/:step
```

### Customers

```txt
GET /api/customers
POST /api/customers
GET /api/customers/:id
PATCH /api/customers/:id
DELETE /api/customers/:id
```

### Payment Orders

```txt
GET /api/payment-orders
POST /api/payment-orders
GET /api/payment-orders/:id
PATCH /api/payment-orders/:id
POST /api/payment-orders/:id/cancel
POST /api/payment-orders/:id/duplicate
```

### Payment Links

```txt
GET /api/payment-links
POST /api/payment-orders/:id/link
GET /api/payment-links/:id
POST /api/payment-links/:id/disable
POST /api/payment-links/:id/duplicate
GET /api/payment-links/:id/qr
```

### Public Payment Portal

```txt
GET /api/public/payment-links/:slug
POST /api/public/payment-links/:slug/checkout
GET /api/public/payment-links/:slug/status
POST /api/public/payment-links/:slug/invoice-request
```

### Stripe

```txt
GET /api/stripe/account
POST /api/stripe/connect
POST /api/stripe/onboarding-link
POST /api/stripe/refresh
GET /api/stripe/dashboard-link
POST /api/stripe/webhook
```

### Payments

```txt
GET /api/payments
GET /api/payments/:id
POST /api/payments/:id/refund
GET /api/payments/:id/receipt
```

### Invoices

```txt
GET /api/invoices
GET /api/invoices/:id
POST /api/invoices/:id/generate
GET /api/invoices/:id/pdf
GET /api/invoices/:id/xml
POST /api/invoices/:id/cancel
```

## Frontend Esperado

El frontend debe dividirse en tres zonas:

- Sitio publico.
- Portal publico de pago.
- Dashboard privado del negocio.

Rutas principales:

```txt
/
/pricing
/contact
/login
/register
/forgot-password
/reset-password
/terms
/privacy

/pay/[slug]
/pay/[slug]/success
/pay/[slug]/cancel

/invoice/[code]
/invoice/[code]/success

/dashboard
/customers
/customers/[id]
/payment-orders
/payment-orders/new
/payment-orders/[id]
/payment-links
/payments
/invoices
/reports
/stripe
/deposits
/settings
/settings/company
/settings/branding
/settings/users
/settings/billing
/settings/api-keys
/settings/notifications
/audit
/support
```

## MVP Recomendado

Para validar la idea, el MVP debe incluir:

- Registro.
- Login.
- Onboarding inicial.
- Crear negocio.
- Configurar negocio.
- Conectar Stripe.
- Crear clientes.
- Crear cobros.
- Generar link de pago.
- Copiar link.
- Generar QR.
- Portal publico `/pay/[slug]`.
- Crear Checkout Session.
- Success/cancel.
- Webhook de Stripe.
- Lista de pagos.
- Dashboard simple.
- Configuracion de empresa.

## Version Pro

Despues del MVP:

- Facturacion CFDI.
- Portal de autofacturacion.
- Reportes avanzados.
- Usuarios y roles avanzados.
- Recordatorios.
- WhatsApp.
- Depositos.
- API keys.
- Auditoria visual avanzada.
- Marca blanca.
- Dominio personalizado.
- Planes SaaS.
- Comisiones.

## Orden Recomendado De Construccion

1. Diseñar schema Prisma multi-negocio.
2. Agregar `Business`, `Membership` y `BusinessSettings`.
3. Adaptar registro para crear negocio y owner.
4. Agregar contexto de negocio activo en requests protegidas.
5. Reforzar permisos por negocio.
6. Crear modulo `customers`.
7. Crear modulo `payment-orders`.
8. Crear modulo `payment-links`.
9. Crear modulo `stripe`.
10. Implementar Stripe Connect.
11. Implementar pagina publica de pago en backend.
12. Crear Checkout Session.
13. Implementar webhooks de Stripe.
14. Crear modulo `payments`.
15. Crear recibo simple.
16. Agregar reportes basicos.
17. Agregar auditoria.
18. Agregar facturacion CFDI despues del MVP.

## Reglas Tecnicas Importantes

- Todo dato privado debe filtrar por `businessId`.
- Los endpoints publicos solo deben exponer informacion minima del link.
- Los pagos se confirman solo con webhooks.
- Los repositories no deben devolver entidades Prisma completas.
- Las respuestas deben usar `Response` o `Entity` por modulo.
- Las acciones deben responder objetos simples.
- Las validaciones deben usar DTOs.
- Los mensajes deben pasar por i18n cuando sean visibles al usuario.
- Los cambios importantes deben registrarse en auditoria.
- Los secretos de Stripe no deben exponerse al frontend.
- Los webhooks deben validar firma de Stripe.

## Proximo Paso Recomendado

El siguiente paso tecnico debe ser disenar y aplicar el primer schema Prisma del dominio:

```txt
Business
Membership
BusinessSettings
StripeAccount
Customer
PaymentOrder
PaymentLink
Payment
```

Con eso se puede construir el primer flujo real:

```txt
Crear cobro -> generar link -> abrir link publico -> pagar con Stripe -> webhook confirma -> cobro pagado
```
