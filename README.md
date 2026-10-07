# Contavia — SaaS contable con facturación CFDI

Demostración hecha para una vacante de continuidad sobre un SaaS contable que
opera en México, con backend en Fastify, Prisma y PostgreSQL y frontend en React
y Vite. La vacante pide tres cosas concretas: estabilizar lo que ya existe,
integrar el timbrado CFDI con un proveedor externo, y aislamiento estricto entre
negocios.

Esta demostración es la mejora concreta: el módulo de facturación CFDI 4.0
funcionando, con emisión, timbrado, complementos de pago y cancelación con
motivo, dentro de un sistema multiempresa.

No se llama a ningún PAC ni al SAT. Los UUID y los sellos se generan aquí. Lo
que sí es real es la regla fiscal.

## Las cuatro cosas que esto existe para enseñar

**El IVA se calcula por concepto, no sobre el subtotal.** Tres conceptos de
$33.33 dan $5.33 de IVA cada uno: $15.99. Calculado sobre el subtotal de $99.99
daría $16.00. El SAT valida que `TotalImpuestosTrasladados` sea la suma de los
traslados de cada concepto, así que la segunda forma es un rechazo del PAC — y
de los que menos se entienden, porque el error no dice qué concepto lo causó.
La factura `A-00005` de la semilla existe sólo para enseñar ese centavo.

**PUE y PPD son dos productos distintos.** Una PPD se emite con forma de pago
99, «por definir», porque al emitir todavía no se sabe cómo van a pagar; cada
abono posterior genera su propio CFDI de pago, con UUID propio, a más tardar el
día cinco del mes siguiente. Una PUE no lleva complemento nunca. Equivocarse
aquí no es un error de interfaz, es un incumplimiento.

**Cancelar no es borrar, y tiene orden.** El motivo 01 exige el UUID del
comprobante que sustituye, y ese comprobante tiene que existir y estar timbrado
antes. Una factura con complementos de pago vigentes no se cancela: primero se
cancelan los complementos, del último al primero, porque cada uno declara el
saldo que dejó el anterior. Y fuera del ejercicio de emisión ya no procede.

**El aislamiento no puede depender de acordarse del `where`.** Cada lectura y
cada escritura recibe la empresa y filtra por ella; un identificador de otra
empresa simplemente no existe. En producción esto va en Row Level Security de
Postgres, con la empresa en una variable de sesión, para que una consulta sin
filtro devuelva cero filas en vez de las del vecino. Prisma no ayuda con esto:
un `where` olvidado compila, pasa el code review y pasa las pruebas.

## Decisión que sostiene lo demás

**Todo importe es entero, en centavos.** No existe un `number` representando
pesos en ninguna parte; la conversión a "$1,234.56" ocurre una sola vez, al
imprimir. Con flotantes, la suma que el SAT valida falla una de cada tantas
facturas.

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/` | Facturado del mes, IVA trasladado, saldos por cobrar y complementos dentro del plazo |
| `/facturas` | Lista con búsqueda y filtros por método y estado, todo en la URL |
| `/facturas/nueva` | Emisión con vista previa del IVA por concepto antes de guardar |
| `/facturas/:id` | Conceptos, totales, XML, timbrado, complementos y cancelación |
| `/complementos` | Todos los CFDI de pago, con su parcialidad, insoluto y plazo |
| `/clientes` | Receptores de la empresa activa, con su saldo |

## Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `diego@albatros.mx` | `admin123` |
| Contador | `norma@albatros.mx` | `conta123` |
| Facturación | `ivan@albatros.mx` | `factura123` |

Hay una cuarta cuenta desactivada, `paulina@trevino.mx`, para ver que una cuenta
inactiva no entra aunque la contraseña sea correcta. El administrador ve dos
empresas y puede cambiar entre ellas; el contador sólo una, y la factura de la
otra no le abre ni con el identificador en la mano.

## Stack

Vite, React 19, TypeScript, Tailwind v4, React Router v6, Zustand, Lucide,
Sonner. Componentes propios sobre `<dialog>` nativo. El estado vive en
`localStorage` detrás de una API asíncrona en `src/lib/api.ts`; reemplazarla por
Fastify y Prisma es editar ese archivo.

    npm install
    npm run dev

## Verificación

1.491 aserciones sobre el núcleo fiscal, corridas en Node contra `src/lib/*`, y
83 aserciones de navegador contra la build, a 1360px y a 390px. Sin errores de
consola.

Después de que la batería pasó, se corrieron seis versiones deliberadamente
ingenuas al lado para ver si las aserciones de verdad rompían: IVA sobre el
subtotal, cancelar sin mirar los complementos vivos, motivo 01 sin exigir
sustitución, cancelar complementos en cualquier orden, lectura sin filtrar por
empresa, y abono sin tope de saldo. Las seis rompieron.

Lo que la verificación encontró y cambió el código:

1. Una columna de rejilla vale `auto` por omisión y `auto` no baja de
   min-content: la tabla de conceptos arrastraba sus 620px y desbordaba la
   página entera en el teléfono.
2. El enlace desde la ficha de un cliente llevaba a `/facturas?q=…` pero la
   búsqueda vivía en estado local, así que llegaba a una lista sin filtrar. La
   búsqueda se movió a la URL.
3. El botón de cancelar se ofrecía en facturas que ya se sabía que no se podían
   cancelar; ahora va deshabilitado con el motivo en el propio botón.
4. En el teléfono la tabla de facturas empujaba el total y el estado fuera de la
   pantalla, que son justo las dos columnas que se buscan de un vistazo.

Justin Gnoh · octubre de 2026
