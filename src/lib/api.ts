import {
  calcularConcepto, pagosVigentes, puedeCancelarFactura, puedeCancelarPago,
  saldoDe, sello, totalesDe, uuidDesde, validarMotivo,
} from "./fiscal";
import { semear } from "./semilla";
import type {
  Centavos, Cliente, Concepto, Datos, Factura, MetodoPago, Pago, Usuario,
} from "./tipos";

const CLAVE = "contable:datos:v1";

const espera = (min = 200, max = 600) =>
  new Promise<void>((r) => setTimeout(r, min + Math.random() * (max - min)));

function leer(): Datos {
  try {
    const bruto = localStorage.getItem(CLAVE);
    if (bruto) return JSON.parse(bruto) as Datos;
  } catch {
    /* almacenamiento bloqueado o corrupto: se vuelve a sembrar */
  }
  const nuevo = semear();
  guardar(nuevo);
  return nuevo;
}

function guardar(d: Datos): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(d));
  } catch {
    /* sin espacio o en incógnito: la sesión sigue en memoria */
  }
}

let seq = 0;
const nuevoId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export class ReglaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ReglaError";
  }
}

export async function obtenerDatos(): Promise<Datos> {
  await espera(150, 350);
  return leer();
}

// --------------------------------------------------------------- sesión

export async function entrar(correo: string, contrasena: string): Promise<Usuario> {
  await espera();
  const d = leer();
  const u = d.usuarios.find((x) => x.correo.toLowerCase() === correo.trim().toLowerCase());
  if (!u || u.contrasena !== contrasena) throw new ReglaError("Correo o contraseña incorrectos.");
  if (!u.activo) throw new ReglaError("Esta cuenta está desactivada. Contacte al administrador.");
  d.sesionId = u.id;
  d.empresaActivaId = u.empresas[0] ?? null;
  guardar(d);
  return u;
}

export async function salir(): Promise<void> {
  const d = leer();
  d.sesionId = null;
  d.empresaActivaId = null;
  guardar(d);
  await espera(100, 200);
}

/**
 * Cambiar de empresa no es un filtro de interfaz: es cambiar el inquilino.
 * Si el usuario no tiene esa empresa asignada, no hay cambio que valga.
 */
export async function cambiarEmpresa(empresaId: string): Promise<Datos> {
  await espera(150, 300);
  const d = leer();
  const u = d.usuarios.find((x) => x.id === d.sesionId);
  if (!u) throw new ReglaError("No hay sesión.");
  if (!u.empresas.includes(empresaId))
    throw new ReglaError("Su usuario no tiene acceso a esa empresa.");
  d.empresaActivaId = empresaId;
  guardar(d);
  return d;
}

// -------------------------------------------------------------- lecturas

/*
 * Todas las lecturas reciben la empresa y filtran por ella. En producción esto
 * no debe depender de que alguien se acuerde de poner el `where`: va en Row
 * Level Security de Postgres, con la empresa en una variable de sesión, para
 * que una consulta sin filtro devuelva cero filas en vez de las del vecino.
 */
export const clientesDe = (d: Datos, empresaId: string): Cliente[] =>
  d.clientes.filter((c) => c.empresaId === empresaId).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

export const facturasDe = (d: Datos, empresaId: string): Factura[] =>
  d.facturas.filter((f) => f.empresaId === empresaId).sort((a, b) => b.fecha.localeCompare(a.fecha));

export const pagosDe = (d: Datos, empresaId: string): Pago[] =>
  d.pagos.filter((p) => p.empresaId === empresaId).sort((a, b) => b.fecha.localeCompare(a.fecha));

/** Devuelve null, no lanza: un id de otra empresa simplemente no existe aquí. */
export const facturaDe = (d: Datos, empresaId: string, facturaId: string): Factura | null =>
  d.facturas.find((f) => f.id === facturaId && f.empresaId === empresaId) ?? null;

function exigirFactura(d: Datos, empresaId: string, facturaId: string): Factura {
  const f = facturaDe(d, empresaId, facturaId);
  if (!f) throw new ReglaError("Factura no encontrada en esta empresa.");
  return f;
}

// ------------------------------------------------------------- facturas

export interface LineaNueva {
  claveProdServ: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: Centavos;
}

export interface FacturaNueva {
  clienteId: string;
  metodoPago: MetodoPago;
  formaPago: string;
  usoCFDI: string;
  lineas: LineaNueva[];
}

export async function crearFactura(empresaId: string, nueva: FacturaNueva): Promise<Factura> {
  await espera();
  const d = leer();
  const empresa = d.empresas.find((e) => e.id === empresaId);
  if (!empresa) throw new ReglaError("Empresa no encontrada.");
  const cliente = d.clientes.find((c) => c.id === nueva.clienteId && c.empresaId === empresaId);
  if (!cliente) throw new ReglaError("El cliente no pertenece a esta empresa.");
  if (!nueva.lineas.length) throw new ReglaError("La factura necesita al menos un concepto.");
  for (const l of nueva.lineas) {
    if (!l.descripcion.trim()) throw new ReglaError("Todo concepto necesita descripción.");
    if (!(l.cantidad > 0)) throw new ReglaError("La cantidad tiene que ser mayor que cero.");
    if (!(l.valorUnitario > 0)) throw new ReglaError("El valor unitario tiene que ser mayor que cero.");
  }
  // PPD no lleva forma de pago conocida al emitir: por eso existe el 99.
  if (nueva.metodoPago === "PPD" && nueva.formaPago !== "99")
    throw new ReglaError("En PPD la forma de pago al emitir es 99, «por definir»: todavía no se sabe cómo se va a pagar.");
  if (nueva.metodoPago === "PUE" && nueva.formaPago === "99")
    throw new ReglaError("En PUE la forma de pago no puede ser 99: el pago ya ocurrió, hay que decir cómo.");

  const conceptos: Concepto[] = nueva.lineas.map((l) => {
    const { importe, traslado } = calcularConcepto(l.cantidad, l.valorUnitario);
    return {
      id: nuevoId("cp"), claveProdServ: l.claveProdServ.trim() || "01010101",
      descripcion: l.descripcion.trim(), cantidad: l.cantidad, valorUnitario: l.valorUnitario,
      importe, traslado, tasaTraslado: 0.16,
    };
  });
  const t = totalesDe(conceptos);
  const folio = Math.max(0, ...d.facturas.filter((f) => f.empresaId === empresaId).map((f) => f.folio)) + 1;

  const factura: Factura = {
    id: nuevoId("f"), empresaId, clienteId: nueva.clienteId, serie: empresa.serie, folio,
    uuid: null, fecha: new Date().toISOString(), timbradaEn: null,
    metodoPago: nueva.metodoPago, formaPago: nueva.formaPago, usoCFDI: nueva.usoCFDI,
    conceptos, subtotal: t.subtotal, descuento: 0, traslados: t.traslados,
    retenciones: 0, total: t.total,
    estado: "vigente", motivoCancelacion: null, folioSustitucion: null, canceladaEn: null, sustituyeA: null,
  };
  d.facturas.push(factura);
  guardar(d);
  return factura;
}

export async function timbrar(empresaId: string, facturaId: string): Promise<Factura> {
  // El timbrado es una llamada al PAC y tarda; la interfaz tiene que aguantar eso.
  await espera(700, 1300);
  const d = leer();
  const f = exigirFactura(d, empresaId, facturaId);
  if (f.uuid) throw new ReglaError("Esta factura ya está timbrada.");
  const empresa = d.empresas.find((e) => e.id === empresaId)!;

  const t = totalesDe(f.conceptos, f.descuento, f.retenciones);
  if (t.total !== f.total || t.traslados !== f.traslados)
    throw new ReglaError("Los totales no cuadran con los conceptos. El PAC rechazaría el comprobante.");

  f.uuid = uuidDesde(`${empresa.rfc}-${f.serie}-${f.folio}-${f.fecha}`);
  f.timbradaEn = new Date().toISOString();
  guardar(d);
  return f;
}

export async function cancelarFactura(
  empresaId: string, facturaId: string, motivo: string, folioSustitucion: string | null,
): Promise<Factura> {
  await espera(500, 900);
  const d = leer();
  const f = exigirFactura(d, empresaId, facturaId);

  const puede = puedeCancelarFactura(f, d.pagos.filter((p) => p.empresaId === empresaId));
  if (!puede.puede) throw new ReglaError(puede.razon);
  const motivoOk = validarMotivo(motivo, folioSustitucion);
  if (!motivoOk.puede) throw new ReglaError(motivoOk.razon);

  if (motivo === "01") {
    const sustituta = d.facturas.find((x) => x.empresaId === empresaId && x.uuid === folioSustitucion);
    if (!sustituta)
      throw new ReglaError("El UUID de sustitución no corresponde a ninguna factura timbrada de esta empresa.");
    if (sustituta.id === f.id) throw new ReglaError("Una factura no puede sustituirse a sí misma.");
    if (sustituta.estado === "cancelado")
      throw new ReglaError("La factura que sustituye está cancelada: no puede relacionarse con ella.");
    sustituta.sustituyeA = f.uuid;
  }

  f.estado = "cancelado";
  f.motivoCancelacion = motivo;
  f.folioSustitucion = folioSustitucion;
  f.canceladaEn = new Date().toISOString();
  guardar(d);
  return f;
}

export async function eliminarBorrador(empresaId: string, facturaId: string): Promise<void> {
  await espera(200, 400);
  const d = leer();
  const f = exigirFactura(d, empresaId, facturaId);
  if (f.uuid) throw new ReglaError("Una factura timbrada no se elimina, se cancela.");
  d.facturas = d.facturas.filter((x) => x.id !== facturaId);
  guardar(d);
}

// --------------------------------------------------------------- pagos

export async function registrarPago(
  empresaId: string, facturaId: string, monto: Centavos, formaPago: string,
): Promise<Pago> {
  await espera(600, 1100);
  const d = leer();
  const f = exigirFactura(d, empresaId, facturaId);

  if (!f.uuid) throw new ReglaError("No se puede recibir pago de una factura sin timbrar.");
  if (f.estado === "cancelado") throw new ReglaError("Esta factura está cancelada.");
  if (f.metodoPago !== "PPD")
    throw new ReglaError("Esta factura es PUE: el pago ya quedó declarado en ella y no lleva complemento.");
  if (formaPago === "99")
    throw new ReglaError("El complemento de pago exige la forma de pago real: ya se sabe cómo se pagó.");

  const propios = d.pagos.filter((p) => p.empresaId === empresaId);
  const saldoAnterior = saldoDe(f, propios);
  if (!(monto > 0)) throw new ReglaError("El monto tiene que ser mayor que cero.");
  if (monto > saldoAnterior)
    throw new ReglaError(`El abono excede el saldo insoluto. Quedan ${(saldoAnterior / 100).toFixed(2)} pesos por pagar.`);

  const parcialidad = pagosVigentes(propios, f.id).length + 1;
  const pago: Pago = {
    id: nuevoId("p"), empresaId, facturaId, uuid: uuidDesde(`pago-${facturaId}-${parcialidad}-${Date.now()}`),
    fecha: new Date().toISOString(), formaPago, monto, parcialidad,
    saldoAnterior, saldoInsoluto: saldoAnterior - monto,
    estado: "vigente", motivoCancelacion: null, canceladaEn: null,
  };
  d.pagos.push(pago);
  guardar(d);
  return pago;
}

export async function cancelarPago(empresaId: string, pagoId: string, motivo: string): Promise<Pago> {
  await espera(400, 800);
  const d = leer();
  const p = d.pagos.find((x) => x.id === pagoId && x.empresaId === empresaId);
  if (!p) throw new ReglaError("Complemento no encontrado en esta empresa.");
  const puede = puedeCancelarPago(p, d.pagos.filter((x) => x.empresaId === empresaId));
  if (!puede.puede) throw new ReglaError(puede.razon);
  const motivoOk = validarMotivo(motivo, null);
  if (!motivoOk.puede) throw new ReglaError(motivoOk.razon);
  p.estado = "cancelado";
  p.motivoCancelacion = motivo;
  p.canceladaEn = new Date().toISOString();
  guardar(d);
  return p;
}

export async function restaurar(): Promise<Datos> {
  const nuevo = semear();
  guardar(nuevo);
  await espera(250, 450);
  return nuevo;
}

export const selloDe = sello;
