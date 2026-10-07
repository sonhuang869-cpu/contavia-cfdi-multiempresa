import {
  ejercicio,
  type Centavos, type Concepto, type Factura, type Pago,
} from "./tipos";

export const TASA_IVA = 0.16;

/**
 * Importe y traslado de un concepto, ya redondeados a centavos.
 *
 * El redondeo ocurre aquí, por concepto, y no al final sobre el subtotal. Esa
 * diferencia es la causa más común de rechazo en el timbrado: el SAT valida que
 * el total de impuestos trasladados sea la suma de los traslados de cada
 * concepto, y calcular el IVA sobre el subtotal da un resultado distinto cuando
 * los importes individuales caen a la mitad del centavo.
 */
export function calcularConcepto(
  cantidad: number,
  valorUnitario: Centavos,
  tasa = TASA_IVA,
): { importe: Centavos; traslado: Centavos } {
  const importe = Math.round(cantidad * valorUnitario);
  return { importe, traslado: Math.round(importe * tasa) };
}

export interface Totales {
  subtotal: Centavos;
  descuento: Centavos;
  traslados: Centavos;
  retenciones: Centavos;
  total: Centavos;
}

export function totalesDe(
  conceptos: Pick<Concepto, "importe" | "traslado">[],
  descuento: Centavos = 0,
  retenciones: Centavos = 0,
): Totales {
  const subtotal = conceptos.reduce((s, c) => s + c.importe, 0);
  const traslados = conceptos.reduce((s, c) => s + c.traslado, 0);
  return { subtotal, descuento, traslados, retenciones, total: subtotal - descuento + traslados - retenciones };
}

/** Lo que el PAC calcularía sobre el subtotal. Existe para poder enseñar la diferencia. */
export const trasladoIngenuo = (subtotal: Centavos, descuento: Centavos = 0, tasa = TASA_IVA): Centavos =>
  Math.round((subtotal - descuento) * tasa);

/** La regla que el SAT valida, escrita tal cual. */
export const totalCuadra = (t: Totales): boolean =>
  t.total === t.subtotal - t.descuento + t.traslados - t.retenciones;

// ------------------------------------------------------------------ saldos

export const pagosVigentes = (pagos: Pago[], facturaId: string): Pago[] =>
  pagos.filter((p) => p.facturaId === facturaId && p.estado === "vigente")
    .sort((a, b) => a.parcialidad - b.parcialidad);

export function saldoDe(factura: Factura, pagos: Pago[]): Centavos {
  if (factura.metodoPago === "PUE") return 0;
  const abonado = pagosVigentes(pagos, factura.id).reduce((s, p) => s + p.monto, 0);
  return factura.total - abonado;
}

export const requiereComplemento = (f: Factura): boolean =>
  f.metodoPago === "PPD" && f.estado === "vigente" && f.uuid !== null;

/**
 * El complemento de pago se emite a más tardar el día cinco del mes siguiente
 * a aquel en que se recibió el pago. No es una recomendación interna: es el
 * plazo del que cuelga la multa.
 */
export function limiteComplemento(fechaPago: string): string {
  const d = new Date(fechaPago);
  return new Date(d.getFullYear(), d.getMonth() + 1, 5, 23, 59, 59).toISOString();
}

export const complementoFueraDePlazo = (fechaPago: string, emitidoEn: string): boolean =>
  new Date(emitidoEn).getTime() > new Date(limiteComplemento(fechaPago)).getTime();

// ------------------------------------------------------------ cancelación

export interface Veredicto {
  puede: boolean;
  razon: string;
}

/**
 * Cancelar un CFDI no es borrar un registro.
 *
 * Las reglas de abajo no son políticas de este sistema: son del SAT, y cada una
 * de ellas es un rechazo del PAC si se intenta de todos modos.
 */
export function puedeCancelarFactura(
  factura: Factura,
  pagos: Pago[],
  hoy = new Date(),
): Veredicto {
  if (!factura.uuid)
    return { puede: false, razon: "Esta factura todavía no se timbra: es un borrador, se elimina, no se cancela." };
  if (factura.estado === "cancelado")
    return { puede: false, razon: "Esta factura ya está cancelada." };

  // El orden importa: primero se cancelan los complementos, después la factura.
  // Al revés, el PAC rechaza y queda un complemento vivo apuntando a un CFDI
  // que ya no existe.
  const vivos = pagosVigentes(pagos, factura.id).filter((p) => p.uuid);
  if (vivos.length)
    return {
      puede: false,
      razon: `Tiene ${vivos.length} complemento${vivos.length === 1 ? "" : "s"} de pago vigente${vivos.length === 1 ? "" : "s"}. Hay que cancelar primero los complementos, en orden inverso a su parcialidad.`,
    };

  if (ejercicio(factura.fecha) !== hoy.getFullYear())
    return {
      puede: false,
      razon: `La factura es del ejercicio ${ejercicio(factura.fecha)} y estamos en ${hoy.getFullYear()}. Fuera del ejercicio de emisión la cancelación ya no procede por este camino.`,
    };

  return { puede: true, razon: "" };
}

export function validarMotivo(motivo: string, folioSustitucion: string | null): Veredicto {
  if (!motivo) return { puede: false, razon: "Falta el motivo de cancelación." };
  if (motivo === "01" && !folioSustitucion)
    return {
      puede: false,
      razon: "El motivo 01 es «emitido con errores con relación»: exige el UUID de la factura que lo sustituye, y esa factura tiene que existir y estar timbrada antes.",
    };
  if (motivo !== "01" && folioSustitucion)
    return { puede: false, razon: "Sólo el motivo 01 lleva folio de sustitución." };
  return { puede: true, razon: "" };
}

export function puedeCancelarPago(pago: Pago, pagos: Pago[]): Veredicto {
  if (!pago.uuid) return { puede: false, razon: "Este complemento todavía no se timbra." };
  if (pago.estado === "cancelado") return { puede: false, razon: "Este complemento ya está cancelado." };
  const posteriores = pagosVigentes(pagos, pago.facturaId).filter((p) => p.parcialidad > pago.parcialidad);
  if (posteriores.length)
    return {
      puede: false,
      razon: `Hay ${posteriores.length} parcialidad${posteriores.length === 1 ? "" : "es"} posterior${posteriores.length === 1 ? "" : "es"}. Los complementos se cancelan del último al primero, porque cada uno declara el saldo que dejó el anterior.`,
    };
  return { puede: true, razon: "" };
}

// -------------------------------------------------------------- timbrado

/** Lo que devuelve el PAC. Aquí se inventa; en producción llega del proveedor. */
export interface Timbre {
  uuid: string;
  selloCFD: string;
  selloSAT: string;
  noCertificadoSAT: string;
  timbradoEn: string;
}

const HEX = "0123456789ABCDEF";

/** UUID v4 determinista a partir de una semilla, para que la demo no cambie sola. */
export function uuidDesde(semilla: string): string {
  let h = 2166136261;
  const bytes: number[] = [];
  for (let i = 0; i < 32; i++) {
    for (const c of semilla + ":" + i) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    bytes.push((h >>> 0) % 16);
  }
  const s = bytes.map((b) => HEX[b]).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-A${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

export function sello(semilla: string, largo = 172): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let h = 2166136261;
  let salida = "";
  for (let i = 0; i < largo; i++) {
    for (const c of semilla + i) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    salida += alfabeto[(h >>> 0) % alfabeto.length];
  }
  return salida;
}
