# Auditoria y trazabilidad

Este backend separa logs tecnicos y auditoria persistente por tablas. La idea es conservar trazabilidad para certificacion sin mezclar todos los eventos en un solo modelo.

## Tablas

| Tabla               | Uso                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `RequestLog`        | Registro tecnico de peticiones HTTP: metodo, ruta, status, duracion, requestId, origen, usuario, compania y payload redacted. |
| `SecurityAuditLog`  | Seguridad, autenticacion, sesiones, CSRF, tokens, bloqueos, permisos insuficientes y compania denegada.                       |
| `AccessAuditLog`    | Usuarios, roles, permisos y accesos.                                                                                          |
| `BusinessAuditLog`  | Operacion interna: companias, subcompanias, conductores, vehiculos, combustibles, estaciones, documentos y notificaciones.    |
| `CardAuditLog`      | Tarjetas locales, portal tarjetahabiente, lecturas sensibles de tarjeta, NIP, bloqueo/desbloqueo y movimientos.               |
| `CardcloudAuditLog` | Llamadas y flujos contra Cardcloud, stock Cardcloud, subcuentas, movimientos, transferencias y errores externos.              |

## Registro automatico

Cada request crea un `RequestLog`. Ademas, el backend clasifica la ruta y crea un evento resumido en la tabla de auditoria correspondiente:

- `/api/authentication/*` -> `SecurityAuditLog`
- `/api/users/*`, `/api/roles/*`, `/api/permissions/*` -> `AccessAuditLog`
- `/api/cardcloud/*`, `/api/cardcloud-stock/*` -> `CardcloudAuditLog`
- `/api/cards/*`, `/api/cardholder/*`, `/api/cardholders/*` -> `CardAuditLog`
- Modulos operativos como companias, subcompanias, conductores, vehiculos, combustibles, estaciones, documentos y notificaciones -> `BusinessAuditLog`

La accion automatica se genera con el metodo y la ruta normalizada, por ejemplo:

```txt
get_cards_id_movements
post_users
patch_sub_companies_id
post_cardcloud_account_transfer
```

Los UUIDs y otros identificadores largos se normalizan como `id` para que las acciones sean agrupables.

## Registro especifico

Ademas del registro automatico, algunos flujos guardan eventos especificos:

- Autenticacion y seguridad: login exitoso, login fallido, cuenta bloqueada, 2FA requerido, 2FA fallido/exitoso, refresh token usado, invalido, expirado, reutilizado o ausente, logout, logout all, revocacion de sesion, token/sesion invalida, sesion expirada, sesion vencida por inactividad, CSRF rechazado, permisos insuficientes, compania denegada y obligacion de cambiar contrasena.
- Accesos: creacion, actualizacion y eliminacion de usuarios, roles y permisos; asignacion, reemplazo y retiro de accesos; cambio de contrasena por administrador; desvinculacion 2FA; reenvio de credenciales.
- Operacion: creacion, actualizacion y desactivacion de companias, subcompanias, conductores, vehiculos, combustibles, estaciones y combustibles de estacion.
- Exportaciones operativas: descarga de conductores, vehiculos y tarjetas de una subcompania.
- Documentos: carga, actualizacion, descarga y eliminacion logica.
- Notificaciones: creacion manual/sistema, consulta, marcado individual como leida y marcado masivo como leidas.
- WebSocket de notificaciones: conexion autorizada, conexion rechazada y desconexion.
- Tarjetas administrativas: creacion, actualizacion, desactivacion, validacion fisica, consulta de movimientos, asignacion a subcompania, sincronizacion de tarjetas de subcuenta, asignacion a vehiculo y desasignacion.
- Tarjetahabiente: consulta de perfil, subcompania, vehiculos, tarjetas, tarjeta individual, movimientos, datos sensibles, cambio de NIP, bloqueo/desbloqueo y validacion fisica.
- Cardholders: consulta del listado filtrable de usuarios tarjetahabiente.
- Cardcloud: consulta de cuenta, movimientos de cuenta, subcuentas, tarjetas de subcuenta, movimientos de subcuenta, tarjeta, movimiento individual, movimientos de tarjeta, datos sensibles, CVV, NIP, validacion, bloqueo/desbloqueo, asignacion de tarjetas, transferencias simples, transferencias masivas, plantilla Excel, procesamiento Excel, stock, sincronizacion de stock y asignacion/desasignacion de stock a subcompania.
- Integracion Cardcloud: cada request externo exitoso o fallido queda registrado con metodo, ruta externa, status cuando exista y mensaje de error sanitizado.

## Datos prohibidos

Nunca guardar en auditoria:

- `password`
- `passwordHash`
- access token
- refresh token
- cookies completas
- `Authorization`
- CVV
- NIP
- PAN completo
- secretos 2FA
- recovery codes

El `AuditService` aplica redaccion automatica por nombre de campo para claves sensibles como `password`, `token`, `secret`, `cvv`, `nip`, `pan`, `authorization` y `cookie`.

## Correlacion

Todas las tablas usan `requestId` cuando existe contexto HTTP. Ese valor permite cruzar:

- log tecnico de consola
- `RequestLog`
- tabla especifica de auditoria
- errores del filtro global

## Resultado

Los eventos usan:

- `success`: flujo completado.
- `failure`: error de proceso o status HTTP no autorizado/no prohibido.
- `denied`: rechazo de seguridad o autorizacion, normalmente `401` o `403`.
