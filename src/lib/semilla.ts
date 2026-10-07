import { calcularConcepto, sello, totalesDe, uuidDesde } from "./fiscal";
import type {
  Cliente, Concepto, Datos, Empresa, Factura, Pago, Usuario,
} from "./tipos";

function prng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) => d.toISOString();
const hace = (ahora: Date, dias: number, hora = 11) => {
  const d = new Date(ahora.getTime() - dias * 86400000);
  d.setHours(hora, 15, 0, 0);
  return d;
};

const CATALOGO = [
  { clave: "81111500", desc: "Servicio de desarrollo de software a la medida", precio: 4500000 },
  { clave: "81112200", desc: "Mantenimiento mensual de sistema contable", precio: 1850000 },
  { clave: "80101500", desc: "Consultoría en procesos administrativos", precio: 950000 },
  { clave: "43232300", desc: "Licencia de uso de plataforma, por usuario", precio: 48500 },
  { clave: "81112100", desc: "Hospedaje y respaldo mensual", precio: 320000 },
  // Tres conceptos de 33.33 en la misma factura: es el caso en que el IVA por
  // concepto y el IVA sobre el subtotal difieren en un centavo.
  { clave: "80141600", desc: "Hora de soporte fuera de horario", precio: 3333 },
];

export function semear(ahora = new Date()): Datos {
  const r = prng(20261007);
  let n = 0;
  const id = (p: string) => `${p}-${String(++n).padStart(4, "0")}`;

  const empresas: Empresa[] = [
    {
      id: "e-01", nombre: "Soluciones Albatros S.A. de C.V.", rfc: "SAL230815QK3",
      regimenFiscal: "601", codigoPostal: "06700", serie: "A",
      creadoEn: iso(hace(ahora, 420)),
    },
    {
      id: "e-02", nombre: "Marisol Treviño Cadena", rfc: "TECM880412H52",
      regimenFiscal: "612", codigoPostal: "64000", serie: "F",
      creadoEn: iso(hace(ahora, 260)),
    },
  ];

  const usuarios: Usuario[] = [
    {
      id: "u-01", nombre: "Diego Peralta", correo: "diego@albatros.mx", contrasena: "admin123",
      rol: "admin", activo: true, empresas: ["e-01", "e-02"],
    },
    {
      id: "u-02", nombre: "Norma Escalante", correo: "norma@albatros.mx", contrasena: "conta123",
      rol: "contador", activo: true, empresas: ["e-01"],
    },
    {
      id: "u-03", nombre: "Iván Robledo", correo: "ivan@albatros.mx", contrasena: "factura123",
      rol: "facturacion", activo: true, empresas: ["e-01"],
    },
    {
      id: "u-04", nombre: "Paulina Cervantes", correo: "paulina@trevino.mx", contrasena: "clave123",
      rol: "admin", activo: false, empresas: ["e-02"],
    },
  ];

  const NOMBRES_E1 = [
    ["Comercializadora Tepeyac S.A. de C.V.", "CTE150302M19", "601", "03100"],
    ["Grupo Industrial Nopalera S.A.P.I.", "GIN190711TF8", "601", "45050"],
    ["Refacciones del Bajío S. de R.L.", "RBA200128L44", "601", "37160"],
    ["Alejandra Montes Fierro", "MOFA910523R71", "612", "76030"],
    ["Transportes Vega Hermanos S.A.", "TVH170905B25", "601", "66220"],
    ["Instituto Cultural Zacatlán A.C.", "ICZ080619EP6", "603", "73310"],
  ];
  const NOMBRES_E2 = [
    ["Panificadora La Espiga S.A. de C.V.", "PES160420D37", "601", "64610"],
    ["Rodrigo Salazar Peña", "SAPR850117KD2", "626", "64700"],
    ["Clínica Veterinaria Monterrey S.C.", "CVM210308H90", "601", "64060"],
  ];

  const clientes: Cliente[] = [
    ...NOMBRES_E1.map(([nombre, rfc, reg, cp], i) => ({
      id: `c-1${i}`, empresaId: "e-01", nombre, rfc, regimenFiscal: reg, codigoPostal: cp,
      correo: `facturacion@${rfc.slice(0, 3).toLowerCase()}.mx`, creadoEn: iso(hace(ahora, 300 - i * 20)),
    })),
    ...NOMBRES_E2.map(([nombre, rfc, reg, cp], i) => ({
      id: `c-2${i}`, empresaId: "e-02", nombre, rfc, regimenFiscal: reg, codigoPostal: cp,
      correo: `pagos@${rfc.slice(0, 3).toLowerCase()}.mx`, creadoEn: iso(hace(ahora, 200 - i * 25)),
    })),
  ];

  const facturas: Factura[] = [];
  const pagos: Pago[] = [];
  const folios = new Map<string, number>([["e-01", 0], ["e-02", 0]]);

  const emitir = (opciones: {
    empresaId: string;
    clienteId: string;
    diasAtras: number;
    metodoPago: "PUE" | "PPD";
    formaPago: string;
    usoCFDI: string;
    lineas: { indice: number; cantidad: number }[];
    timbrar?: boolean;
  }): Factura => {
    const empresa = empresas.find((e) => e.id === opciones.empresaId)!;
    const folio = (folios.get(opciones.empresaId) ?? 0) + 1;
    folios.set(opciones.empresaId, folio);
    const f = hace(ahora, opciones.diasAtras, 9 + Math.floor(r() * 8));

    const conceptos: Concepto[] = opciones.lineas.map((l) => {
      const base = CATALOGO[l.indice];
      const { importe, traslado } = calcularConcepto(l.cantidad, base.precio);
      return {
        id: id("cp"), claveProdServ: base.clave, descripcion: base.desc,
        cantidad: l.cantidad, valorUnitario: base.precio, importe, traslado, tasaTraslado: 0.16,
      };
    });
    const t = totalesDe(conceptos);
    const facturaId = id("f");
    const timbrar = opciones.timbrar !== false;

    const factura: Factura = {
      id: facturaId, empresaId: opciones.empresaId, clienteId: opciones.clienteId,
      serie: empresa.serie, folio,
      uuid: timbrar ? uuidDesde(`${empresa.rfc}-${empresa.serie}-${folio}`) : null,
      fecha: iso(f), timbradaEn: timbrar ? iso(new Date(f.getTime() + 90000)) : null,
      metodoPago: opciones.metodoPago, formaPago: opciones.formaPago, usoCFDI: opciones.usoCFDI,
      conceptos, subtotal: t.subtotal, descuento: 0, traslados: t.traslados, retenciones: 0, total: t.total,
      estado: "vigente", motivoCancelacion: null, folioSustitucion: null, canceladaEn: null, sustituyeA: null,
    };
    facturas.push(factura);
    return factura;
  };

  const abonar = (factura: Factura, diasAtras: number, monto: number, formaPago: string) => {
    const previos = pagos.filter((p) => p.facturaId === factura.id && p.estado === "vigente");
    const saldoAnterior = factura.total - previos.reduce((s, p) => s + p.monto, 0);
    const f = hace(ahora, diasAtras, 13);
    pagos.push({
      id: id("p"), empresaId: factura.empresaId, facturaId: factura.id,
      uuid: uuidDesde(`pago-${factura.id}-${previos.length + 1}`),
      fecha: iso(f), formaPago, monto, parcialidad: previos.length + 1,
      saldoAnterior, saldoInsoluto: saldoAnterior - monto,
      estado: "vigente", motivoCancelacion: null, canceladaEn: null,
    });
  };

  // ---- empresa 1: operación con historia ----
  emitir({ empresaId: "e-01", clienteId: "c-10", diasAtras: 96, metodoPago: "PUE", formaPago: "03", usoCFDI: "G03", lineas: [{ indice: 1, cantidad: 1 }] });
  emitir({ empresaId: "e-01", clienteId: "c-11", diasAtras: 84, metodoPago: "PUE", formaPago: "03", usoCFDI: "G01", lineas: [{ indice: 3, cantidad: 12 }] });

  // PPD con dos parcialidades pagadas y saldo abierto: el caso que obliga a REP
  const ppdAbierta = emitir({
    empresaId: "e-01", clienteId: "c-12", diasAtras: 71, metodoPago: "PPD", formaPago: "99",
    usoCFDI: "G03", lineas: [{ indice: 0, cantidad: 1 }],
  });
  abonar(ppdAbierta, 52, 1500000, "03");
  abonar(ppdAbierta, 24, 2000000, "03");

  // PPD liquidada por completo
  const ppdCerrada = emitir({
    empresaId: "e-01", clienteId: "c-13", diasAtras: 63, metodoPago: "PPD", formaPago: "99",
    usoCFDI: "G03", lineas: [{ indice: 2, cantidad: 2 }],
  });
  abonar(ppdCerrada, 40, Math.floor(ppdCerrada.total / 2), "03");
  abonar(ppdCerrada, 12, ppdCerrada.total - Math.floor(ppdCerrada.total / 2), "02");

  // la factura con tres conceptos de 33.33: el centavo del IVA
  emitir({
    empresaId: "e-01", clienteId: "c-14", diasAtras: 38, metodoPago: "PUE", formaPago: "28",
    usoCFDI: "G03", lineas: [{ indice: 5, cantidad: 1 }, { indice: 5, cantidad: 1 }, { indice: 5, cantidad: 1 }],
  });

  // una cancelada con motivo 02, para que el historial no sea sólo feliz
  const conError = emitir({
    empresaId: "e-01", clienteId: "c-15", diasAtras: 30, metodoPago: "PUE", formaPago: "03",
    usoCFDI: "G03", lineas: [{ indice: 4, cantidad: 3 }],
  });
  conError.estado = "cancelado";
  conError.motivoCancelacion = "02";
  conError.canceladaEn = iso(hace(ahora, 29, 16));

  emitir({ empresaId: "e-01", clienteId: "c-10", diasAtras: 21, metodoPago: "PUE", formaPago: "03", usoCFDI: "G03", lineas: [{ indice: 1, cantidad: 1 }] });
  emitir({ empresaId: "e-01", clienteId: "c-11", diasAtras: 14, metodoPago: "PPD", formaPago: "99", usoCFDI: "G01", lineas: [{ indice: 3, cantidad: 20 }, { indice: 4, cantidad: 1 }] });
  emitir({ empresaId: "e-01", clienteId: "c-12", diasAtras: 6, metodoPago: "PUE", formaPago: "03", usoCFDI: "G03", lineas: [{ indice: 2, cantidad: 1 }] });

  // un borrador sin timbrar
  emitir({
    empresaId: "e-01", clienteId: "c-13", diasAtras: 1, metodoPago: "PUE", formaPago: "03",
    usoCFDI: "G03", lineas: [{ indice: 1, cantidad: 1 }], timbrar: false,
  });

  // ---- empresa 2: la que el aislamiento tiene que mantener aparte ----
  emitir({ empresaId: "e-02", clienteId: "c-20", diasAtras: 58, metodoPago: "PUE", formaPago: "03", usoCFDI: "G03", lineas: [{ indice: 2, cantidad: 1 }] });
  const ppdDos = emitir({ empresaId: "e-02", clienteId: "c-21", diasAtras: 33, metodoPago: "PPD", formaPago: "99", usoCFDI: "G03", lineas: [{ indice: 1, cantidad: 2 }] });
  abonar(ppdDos, 9, 1000000, "03");
  emitir({ empresaId: "e-02", clienteId: "c-22", diasAtras: 11, metodoPago: "PUE", formaPago: "01", usoCFDI: "G03", lineas: [{ indice: 4, cantidad: 2 }] });

  return { empresas, usuarios, clientes, facturas, pagos, sesionId: null, empresaActivaId: null };
}

export const selloDe = sello;
