/**
 * Todo importe es entero, en centavos.
 *
 * El SAT valida que el total del comprobante corresponda exactamente a la suma
 * de importes más traslados menos retenciones y descuentos. Con flotantes esa
 * suma falla una de cada tantas facturas y el PAC rechaza el timbrado con un
 * error que no dice cuál concepto lo causó.
 */
export type Centavos = number;

export type Rol = "admin" | "contador" | "facturacion";

/** Catálogo c_RegimenFiscal del SAT, recortado a los que usa esta demostración. */
export const REGIMENES: Record<string, string> = {
  "601": "General de Ley Personas Morales",
  "603": "Personas Morales con Fines no Lucrativos",
  "612": "Personas Físicas con Actividades Empresariales y Profesionales",
  "616": "Sin obligaciones fiscales",
  "626": "Régimen Simplificado de Confianza",
};

/** Catálogo c_UsoCFDI. */
export const USOS_CFDI: Record<string, string> = {
  G01: "Adquisición de mercancías",
  G03: "Gastos en general",
  I08: "Otra maquinaria y equipo",
  P01: "Por definir",
  S01: "Sin efectos fiscales",
};

/** Catálogo c_FormaPago. */
export const FORMAS_PAGO: Record<string, string> = {
  "01": "Efectivo",
  "02": "Cheque nominativo",
  "03": "Transferencia electrónica de fondos",
  "04": "Tarjeta de crédito",
  "28": "Tarjeta de débito",
  "99": "Por definir",
};

/**
 * PUE o PPD. Es la bifurcación más importante del CFDI y la que más se
 * equivoca: una factura PPD obliga a emitir después un complemento de pago por
 * cada abono, y una PUE no lleva complemento nunca.
 */
export type MetodoPago = "PUE" | "PPD";

export type EstadoCFDI = "vigente" | "cancelado";

/** Catálogo de motivos de cancelación vigente desde 2022. */
export const MOTIVOS_CANCELACION: Record<string, string> = {
  "01": "Comprobante emitido con errores con relación",
  "02": "Comprobante emitido con errores sin relación",
  "03": "No se llevó a cabo la operación",
  "04": "Operación nominativa relacionada en una factura global",
};

export interface Empresa {
  id: string;
  nombre: string;
  rfc: string;
  regimenFiscal: string;
  codigoPostal: string;
  serie: string;
  creadoEn: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  contrasena: string;
  rol: Rol;
  activo: boolean;
  /** A qué empresas tiene acceso. El aislamiento vive aquí y en cada consulta. */
  empresas: string[];
}

export interface Cliente {
  id: string;
  empresaId: string;
  nombre: string;
  rfc: string;
  regimenFiscal: string;
  codigoPostal: string;
  correo: string;
  creadoEn: string;
}

export interface Concepto {
  id: string;
  claveProdServ: string;
  descripcion: string;
  cantidad: number;
  /** Valor unitario en centavos. El SAT admite más decimales; aquí no hacen falta. */
  valorUnitario: Centavos;
  importe: Centavos;
  /** IVA trasladado del concepto, ya redondeado a centavos. */
  traslado: Centavos;
  tasaTraslado: number;
}

export interface Factura {
  id: string;
  empresaId: string;
  clienteId: string;
  serie: string;
  folio: number;
  /** Null mientras no se timbra. El UUID lo asigna el PAC, no nosotros. */
  uuid: string | null;
  fecha: string;
  timbradaEn: string | null;
  metodoPago: MetodoPago;
  formaPago: string;
  usoCFDI: string;
  conceptos: Concepto[];
  subtotal: Centavos;
  descuento: Centavos;
  traslados: Centavos;
  retenciones: Centavos;
  total: Centavos;
  estado: EstadoCFDI;
  motivoCancelacion: string | null;
  folioSustitucion: string | null;
  canceladaEn: string | null;
  /** UUID de la factura que ésta sustituye, cuando se emitió para corregir otra. */
  sustituyeA: string | null;
}

/** Complemento de recepción de pagos. Un CFDI propio, con su propio UUID. */
export interface Pago {
  id: string;
  empresaId: string;
  facturaId: string;
  uuid: string | null;
  fecha: string;
  formaPago: string;
  monto: Centavos;
  parcialidad: number;
  saldoAnterior: Centavos;
  saldoInsoluto: Centavos;
  estado: EstadoCFDI;
  motivoCancelacion: string | null;
  canceladaEn: string | null;
}

export interface Datos {
  empresas: Empresa[];
  usuarios: Usuario[];
  clientes: Cliente[];
  facturas: Factura[];
  pagos: Pago[];
  sesionId: string | null;
  empresaActivaId: string | null;
}

export const ROL_ETIQUETA: Record<Rol, string> = {
  admin: "administrador",
  contador: "contador",
  facturacion: "facturación",
};

/** Centavos a texto. La única conversión a pesos del sistema. */
export const mxn = (c: Centavos): string =>
  ((c || 0) / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export const fecha = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });

export const fechaHora = (iso: string): string =>
  new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const folioCompleto = (f: Factura): string => `${f.serie}-${String(f.folio).padStart(5, "0")}`;

export const ejercicio = (iso: string): number => new Date(iso).getFullYear();
