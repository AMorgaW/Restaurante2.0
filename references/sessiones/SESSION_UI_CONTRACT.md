# Contrato UI de sesiones administrativas

Documento compacto de lectura para las referencias visuales de `references/sessiones`.
Las cifras, nombres y estados mostrados en las imágenes son demostrativos.

| Archivo | Sección | Estructura y componentes reutilizables | Acciones y estados | Navegación | Decisiones visuales |
|---|---|---|---|---|---|
| `administrador.png` | Administrador | Encabezado de marca, avatar, cuatro métricas, estado operativo, operaciones, pedidos recientes y reportes compactos. | Ver horarios, pedidos, menú, promociones, empleados, pensionados y cerrar sesión. Estados abierto/cerrado, pedidos por estado y demo local. | Dashboard como entrada; accesos rápidos a módulos administrativos. No se muestran reservas. | Navy profundo, tarjetas azules, amarillo para CTA, lima para estado/acentos, iconos circulares, radios amplios y mobile-first. |
| `inventario.png` | Inventario | Encabezado, cinco métricas, filtros y listado adaptable de insumos con imagen decorativa, unidad, stock, mínimo, estado y acciones. | Agregar, ingresar cantidad, editar, ajustar, registrar merma, desactivar y eliminar solo sin historial. Estados disponible, bajo, crítico, agotado e inactivo. | Acceso prioritario desde `/admin`; regreso al dashboard; acción secundaria para agregar o ingresar. | En móvil usa tarjetas/filas apiladas sin tabla horizontal; las acciones principales usan amarillo/lima y los riesgos rojo/naranja. |
| `empleado.png` | Empleado | Workspace único `/empleado`: cabecera de turno, métricas, cola, menú del día, inventario rápido, historial e incidencias. Componentes reutilizados de tarjetas, badges, botones y toasts. | Acciones filtradas por `manager`, `kitchen`, `cashier`, `editor` y `support`; estados de servicio, pedido, stock e incidencia. Demo local determinista. | Navegación compacta por anclas; no se crean rutas vacías. URL directa sin cargo de empleado falla cerrada. No se muestran reservas. | Mismo navy/lima/amarillo, operación mobile-first y lectura rápida. El inventario de empleado es solo lectura. |
| `pensionado.png` | Pensionado | `/pensionado` local/demo: cabecera de cliente, tarjeta de plan, estado comercial, selector de fecha/periodo, categorías de comida, historial, calendario y renovación informativa. | Estados sin membresía, pendiente, activo, suspendido, vencido y cancelado. Pago y activación presenciales; no hay autoactivación ni cobro en línea. | Entrada desde la cuenta/demo; menú general y cuenta permanecen disponibles. Estados bloqueados conservan historial mínimo. | Mismo navy, azul profundo, lima/amarillo, tarjetas redondeadas y mobile-first; excedentes y opciones faltantes se explican sin ocultar información. |

## Decisiones de esta etapa

- Los datos del dashboard y de `/admin/inventario` salen del mismo origen tipado y persistido únicamente en el navegador.
- Las imágenes de insumos son temporales y se resuelven mediante un único mapeo central hacia imágenes de platos ya existentes.
- “Consumo de inventario”, “salida por pedido”, “entrada por compra” y “ajuste por merma” sustituyen cualquier lenguaje de descuento automático.
- La experiencia de empleado comparte la matriz de capacidades y la máquina de estados existentes; no crea un rol técnico `employee` ni una segunda autorización.
- En esta etapa `/empleado` solo habilita el demo local. La resolución real de perfil y Auth se reserva para la Etapa 6.
- En la Etapa 4 `/pensionado` sigue usando exclusivamente `profiles.role = customer` y fixtures locales; la membresía comercial no es un rol Auth ni una autorización administrativa.
- El fixture usa modalidad híbrida y fechas deterministas solo para demostración. La decisión comercial entre 30 días, 30 comidas o un modelo híbrido sigue abierta; las sopas sin producto vigente aparecen como “Por configurar”.
- En la Etapa 5 `/admin/empleados` y `/admin/pensionados` conservan el mismo shell visual, tarjetas adaptativas y etiqueta de demo. Empleados se filtra por cargo, sucursal y estado; pensionados destaca solicitudes pendientes y reserva acciones de activación, pago, renovación, suspensión y finalización al `owner`.
- `rb-staff` y `rb-pension-admin` son orígenes locales compartidos con `/empleado` y `/pensionado`; la auditoría se muestra como append-only demo. No se representan contraseñas, pagos en línea ni permisos personalizados.
