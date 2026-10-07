import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Ban, Code2, Receipt, Stamp, Trash2 } from "lucide-react";
import { Aviso, Boton, Campo, Dialogo, Esqueleto, Etiqueta, Importe, Sello, Selector, Vacio } from "@/components/base";
import { useApp } from "@/estado";
import * as api from "@/lib/api";
import { ReglaError } from "@/lib/api";
import {
  limiteComplemento, puedeCancelarFactura, puedeCancelarPago,
  saldoDe, sello, totalesDe, trasladoIngenuo,
} from "@/lib/fiscal";
import {
  fecha, fechaHora, folioCompleto, FORMAS_PAGO, MOTIVOS_CANCELACION, mxn, USOS_CFDI,
} from "@/lib/tipos";
import { cx } from "@/lib/cx";
import NoEncontrado from "./NoEncontrado";

export default function FacturaDetalle() {
  const { id = "" } = useParams();
  const { datos, cargando, empresa, refrescar } = useApp();
  const navegar = useNavigate();
  const e = empresa();
  const [cancelando, setCancelando] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [viendoXml, setViendoXml] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [pagoACancelar, setPagoACancelar] = useState<string | null>(null);

  if (cargando || !datos || !e) return <div className="space-y-3"><Esqueleto className="h-24" /><Esqueleto className="h-64" /></div>;

  const f = api.facturaDe(datos, e.id, id);
  // Una factura de otra empresa no existe aquí. No decimos "sin permiso",
  // porque eso ya confirmaría que existe.
  if (!f) {
    return <NoEncontrado mensaje={`No hay ninguna factura con ese identificador en ${e.nombre}. Si pertenece a otra empresa, cambie de empresa en la barra superior.`} />;
  }

  const cliente = datos.clientes.find((c) => c.id === f.clienteId);
  const pagos = api.pagosDe(datos, e.id);
  const mios = pagos.filter((p) => p.facturaId === f.id).sort((a, b) => a.parcialidad - b.parcialidad);
  const saldo = saldoDe(f, pagos);
  const t = totalesDe(f.conceptos, f.descuento, f.retenciones);
  const ingenuo = trasladoIngenuo(t.subtotal, f.descuento);
  const veredicto = puedeCancelarFactura(f, pagos);
  const sustituta = f.folioSustitucion
    ? api.facturasDe(datos, e.id).find((x) => x.uuid === f.folioSustitucion)
    : null;

  const correr = async (accion: () => Promise<unknown>, exito: string) => {
    setOcupado(true);
    try {
      await accion();
      await refrescar();
      toast.success(exito);
      return true;
    } catch (err) {
      toast.error(err instanceof ReglaError ? err.message : "No fue posible completar la operación.", { duration: 7000 });
      return false;
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link to="/facturas" className="-ml-1 inline-flex min-h-10 items-center gap-1.5 px-1 text-sm text-tinta-media hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden /> Facturas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <span className="clave text-xl">{folioCompleto(f)}</span>
            {!f.uuid
              ? <Sello>borrador</Sello>
              : f.estado === "vigente"
                ? <Sello tono="vigente">vigente</Sello>
                : <Sello tono="alto">cancelada</Sello>}
            <Sello tono={f.metodoPago === "PPD" ? "archivo" : "neutro"}>{f.metodoPago}</Sello>
          </h1>
          <p className="mt-0.5 text-sm text-tinta-media">
            {cliente?.nombre} · <span className="clave">{cliente?.rfc}</span> · {fecha(f.fecha)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!f.uuid && (
            <>
              <Boton disabled={ocupado} data-testid="timbrar"
                onClick={() => correr(() => api.timbrar(e.id, f.id), "Factura timbrada.")}>
                <Stamp className="size-4" aria-hidden /> {ocupado ? "Timbrando…" : "Timbrar"}
              </Boton>
              <Boton variante="contorno" disabled={ocupado} data-testid="eliminar"
                onClick={async () => {
                  if (await correr(() => api.eliminarBorrador(e.id, f.id), "Borrador eliminado.")) navegar("/facturas");
                }}>
                <Trash2 className="size-4" aria-hidden /> Eliminar
              </Boton>
            </>
          )}
          {f.uuid && (
            <Boton variante="contorno" onClick={() => setViendoXml(true)} data-testid="ver-xml">
              <Code2 className="size-4" aria-hidden /> Ver XML
            </Boton>
          )}
          {f.uuid && f.estado === "vigente" && f.metodoPago === "PPD" && saldo > 0 && (
            <Boton onClick={() => setCobrando(true)} data-testid="registrar-pago">
              <Receipt className="size-4" aria-hidden /> Registrar pago
            </Boton>
          )}
          {f.uuid && f.estado === "vigente" && (
            <Boton variante="contorno" onClick={() => setCancelando(true)} data-testid="cancelar"
              disabled={!veredicto.puede} title={veredicto.puede ? "Cancelar esta factura" : veredicto.razon}>
              <Ban className="size-4" aria-hidden /> Cancelar
            </Boton>
          )}
        </div>
      </header>

      {!f.uuid && (
        <Aviso testid="aviso-borrador">
          Todavía no es un CFDI. Sin timbre no hay UUID, no vale fiscalmente y se elimina en lugar de
          cancelarse.
        </Aviso>
      )}

      {f.estado === "cancelado" && (
        <Aviso tono="alto" testid="aviso-cancelada">
          Cancelada el {fechaHora(f.canceladaEn!)} con motivo {f.motivoCancelacion} —{" "}
          {MOTIVOS_CANCELACION[f.motivoCancelacion ?? ""]}
          {sustituta && <> La sustituye <Link to={`/facturas/${sustituta.id}`} className="font-semibold underline">{folioCompleto(sustituta)}</Link>.</>}
        </Aviso>
      )}

      {f.sustituyeA && (
        <Aviso testid="aviso-sustituye">
          Esta factura sustituye al comprobante <span className="clave">{f.sustituyeA}</span>, que fue
          cancelado con motivo 01.
        </Aviso>
      )}

      {!veredicto.puede && f.uuid && f.estado === "vigente" && (
        <Aviso tono="importe" testid="aviso-no-cancelable">
          No se puede cancelar todavía: {veredicto.razon}
        </Aviso>
      )}

      <section className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-linea">
            <table className="w-full min-w-[620px] text-sm">
              <caption className="sr-only">Conceptos del comprobante</caption>
              <thead className="bg-papel text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Clave</th>
                  <th className="px-3 py-2 font-semibold">Descripción</th>
                  <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                  <th className="px-3 py-2 text-right font-semibold">Unitario</th>
                  <th className="px-3 py-2 text-right font-semibold">Importe</th>
                  <th className="px-3 py-2 text-right font-semibold">IVA 16%</th>
                </tr>
              </thead>
              <tbody data-testid="conceptos">
                {f.conceptos.map((c) => (
                  <tr key={c.id} className="border-t border-linea">
                    <td className="clave px-3 py-2 text-tinta-media">{c.claveProdServ}</td>
                    <td className="px-3 py-2">{c.descripcion}</td>
                    <td className="mono px-3 py-2 text-right">{c.cantidad}</td>
                    <td className="mono px-3 py-2 text-right">{mxn(c.valorUnitario)}</td>
                    <td className="mono px-3 py-2 text-right">{mxn(c.importe)}</td>
                    <td className="mono px-3 py-2 text-right text-tinta-media" data-traslado={c.traslado}>{mxn(c.traslado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {t.traslados !== ingenuo && (
            <Aviso tono="importe" testid="aviso-centavo">
              El IVA de esta factura se calcula concepto por concepto y suma{" "}
              <span className="mono font-semibold">{mxn(t.traslados)}</span>. Calculado sobre el
              subtotal daría <span className="mono font-semibold">{mxn(ingenuo)}</span>, un centavo de
              diferencia. El SAT valida la primera forma: el total de impuestos trasladados tiene que
              ser la suma de los traslados de cada concepto. Timbrar con la segunda es el rechazo más
              común y el que menos se entiende, porque el error no dice qué concepto lo causó.
            </Aviso>
          )}

          {f.metodoPago === "PPD" && (
            <section>
              <h2 className="mb-2 text-sm font-bold">Complementos de pago</h2>
              {mios.length === 0 ? (
                <Vacio titulo="Sin pagos registrados">
                  Cada abono que reciba genera un CFDI de pago propio, con su UUID.
                </Vacio>
              ) : (
                <ul className="divide-y divide-linea rounded-md border border-linea bg-tarjeta" data-testid="complementos">
                  {mios.map((p) => {
                    const v = puedeCancelarPago(p, pagos);
                    return (
                      <li key={p.id} className="px-3 py-2.5" data-pago={p.id} data-estado={p.estado}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mono shrink-0 text-sm font-semibold">#{p.parcialidad}</span>
                          <span className="text-sm">{fecha(p.fecha)}</span>
                          <span className="text-xs text-tinta-media">{FORMAS_PAGO[p.formaPago]}</span>
                          {p.estado === "cancelado"
                            ? <Sello tono="alto">cancelado {p.motivoCancelacion}</Sello>
                            : <Sello tono="vigente">vigente</Sello>}
                          <Importe className="ml-auto">{mxn(p.monto)}</Importe>
                          {p.estado === "vigente" && (
                            <Boton variante="fantasma" className="px-2" disabled={ocupado || !v.puede}
                              title={v.puede ? "Cancelar este complemento" : v.razon}
                              data-testid={`cancelar-pago-${p.parcialidad}`}
                              onClick={() => setPagoACancelar(p.id)}>
                              <Ban className="size-3.5" aria-hidden />
                            </Boton>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-tinta-media">
                          saldo anterior <span className="mono">{mxn(p.saldoAnterior)}</span> → insoluto{" "}
                          <span className="mono">{mxn(p.saldoInsoluto)}</span> · complemento a más tardar el{" "}
                          {fecha(limiteComplemento(p.fecha))}
                        </p>
                        {p.uuid && <p className="clave mt-0.5 text-tinta-tenue">{p.uuid}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-md border border-linea bg-tarjeta p-4">
            <h2 className="text-sm font-bold">Totales</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-tinta-media">Subtotal</dt><dd className="mono">{mxn(f.subtotal)}</dd></div>
              {f.descuento > 0 && <div className="flex justify-between"><dt className="text-tinta-media">Descuento</dt><dd className="mono">− {mxn(f.descuento)}</dd></div>}
              <div className="flex justify-between"><dt className="text-tinta-media">IVA trasladado</dt><dd className="mono" data-testid="traslados">{mxn(f.traslados)}</dd></div>
              {f.retenciones > 0 && <div className="flex justify-between"><dt className="text-tinta-media">Retenciones</dt><dd className="mono">− {mxn(f.retenciones)}</dd></div>}
              <div className="flex justify-between border-t border-linea pt-1.5">
                <dt className="font-bold">Total</dt><dd><Importe data-testid="total">{mxn(f.total)}</Importe></dd>
              </div>
              {f.metodoPago === "PPD" && (
                <div className="flex justify-between border-t border-linea pt-1.5">
                  <dt className="font-bold">Saldo insoluto</dt>
                  <dd className={cx("mono font-bold", saldo > 0 ? "text-importe" : "text-vigente")} data-testid="saldo">{mxn(saldo)}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-md border border-linea bg-tarjeta p-4">
            <h2 className="text-sm font-bold">Datos fiscales</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-tinta-media">Uso CFDI</dt><dd className="text-right">{f.usoCFDI} — {USOS_CFDI[f.usoCFDI]}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tinta-media">Forma de pago</dt><dd className="text-right">{f.formaPago} — {FORMAS_PAGO[f.formaPago]}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tinta-media">Método</dt><dd>{f.metodoPago}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tinta-media">Emitida</dt><dd className="mono text-right">{fechaHora(f.fecha)}</dd></div>
              {f.timbradaEn && <div className="flex justify-between gap-2"><dt className="text-tinta-media">Timbrada</dt><dd className="mono text-right">{fechaHora(f.timbradaEn)}</dd></div>}
            </dl>
            {f.uuid && (
              <>
                <p className="mt-3 text-xs font-semibold tracking-wide text-tinta-media uppercase">Folio fiscal</p>
                <p className="clave mt-0.5 break-all text-tinta" data-testid="uuid">{f.uuid}</p>
              </>
            )}
          </div>
        </aside>
      </section>

      <DialogoCancelar
        abierto={cancelando} alCerrar={() => setCancelando(false)} empresaId={e.id} factura={f}
        alConfirmar={async (motivo, folio) => {
          const bien = await correr(() => api.cancelarFactura(e.id, f.id, motivo, folio), "Factura cancelada.");
          if (bien) setCancelando(false);
        }}
        ocupado={ocupado}
      />

      <DialogoPago
        abierto={cobrando} alCerrar={() => setCobrando(false)} saldo={saldo}
        alConfirmar={async (monto, forma) => {
          const bien = await correr(() => api.registrarPago(e.id, f.id, monto, forma), "Complemento de pago timbrado.");
          if (bien) setCobrando(false);
        }}
        ocupado={ocupado}
      />

      <Dialogo abierto={pagoACancelar !== null} alCerrar={() => setPagoACancelar(null)}
        titulo="Cancelar complemento de pago" testid="dialogo-cancelar-pago"
        descripcion="Al cancelar un complemento el saldo de la factura vuelve a abrirse por ese importe.">
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setPagoACancelar(null)}>Volver</Boton>
          <Boton variante="alto" disabled={ocupado} data-testid="confirmar-cancelar-pago"
            onClick={async () => {
              const bien = await correr(() => api.cancelarPago(e.id, pagoACancelar!, "02"), "Complemento cancelado.");
              if (bien) setPagoACancelar(null);
            }}>
            Cancelar complemento
          </Boton>
        </div>
      </Dialogo>

      <Dialogo abierto={viendoXml} alCerrar={() => setViendoXml(false)} ancho="46rem"
        titulo="Comprobante" descripcion="Los campos que el PAC recibe y el timbre que devuelve." testid="dialogo-xml">
        <pre className="max-h-[60vh] overflow-auto rounded-sm bg-tinta p-3 text-[11px] leading-relaxed text-papel" data-testid="xml">
{xmlDe(f, e.rfc, e.regimenFiscal, cliente?.rfc ?? "", cliente?.nombre ?? "", cliente?.codigoPostal ?? "")}
        </pre>
        <p className="mt-2 text-xs text-tinta-media">
          Generado aquí para mostrar la forma. En producción el XML lo sella el certificado de la
          empresa y el timbre lo agrega el PAC.
        </p>
      </Dialogo>
    </div>
  );
}

function DialogoCancelar({ abierto, alCerrar, factura, empresaId, alConfirmar, ocupado }: {
  abierto: boolean; alCerrar: () => void; factura: ReturnType<typeof api.facturaDe>;
  empresaId: string; alConfirmar: (motivo: string, folio: string | null) => void; ocupado: boolean;
}) {
  const datos = useApp((s) => s.datos);
  const [motivo, setMotivo] = useState("02");
  const [folio, setFolio] = useState("");
  if (!factura || !datos) return null;

  const candidatas = api.facturasDe(datos, empresaId)
    .filter((x) => x.uuid && x.estado === "vigente" && x.id !== factura.id);

  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Cancelar factura"
      descripcion="La cancelación lleva motivo, y el motivo 01 lleva además el folio que la sustituye."
      testid="dialogo-cancelar">
      <div className="space-y-3">
        <div>
          <Etiqueta htmlFor="motivo">Motivo</Etiqueta>
          <Selector id="motivo" value={motivo} onChange={(e) => { setMotivo(e.target.value); if (e.target.value !== "01") setFolio(""); }}
            data-testid="motivo">
            {Object.entries(MOTIVOS_CANCELACION).map(([k, v]) => (
              <option key={k} value={k}>{k} — {v}</option>
            ))}
          </Selector>
        </div>

        {motivo === "01" && (
          <div>
            <Etiqueta htmlFor="sustituto" nota="tiene que estar timbrada y vigente antes de cancelar ésta">
              Factura que la sustituye
            </Etiqueta>
            <Selector id="sustituto" value={folio} onChange={(e) => setFolio(e.target.value)} data-testid="sustituto">
              <option value="">Seleccione…</option>
              {candidatas.map((x) => (
                <option key={x.id} value={x.uuid!}>{folioCompleto(x)} — {mxn(x.total)}</option>
              ))}
            </Selector>
            <p className="mt-1 text-xs text-tinta-media">
              El 01 significa «emitido con errores con relación»: el SAT exige saber cuál es el
              comprobante correcto. Si todavía no existe, hay que emitirlo y timbrarlo primero.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
          <Boton variante="alto" disabled={ocupado || (motivo === "01" && !folio)} data-testid="confirmar-cancelar"
            onClick={() => alConfirmar(motivo, motivo === "01" ? folio : null)}>
            {ocupado ? "Cancelando…" : "Cancelar factura"}
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoPago({ abierto, alCerrar, saldo, alConfirmar, ocupado }: {
  abierto: boolean; alCerrar: () => void; saldo: number;
  alConfirmar: (monto: number, forma: string) => void; ocupado: boolean;
}) {
  const [monto, setMonto] = useState("");
  const [forma, setForma] = useState("03");
  const centavos = Math.round(Number(monto.replace(/[^\d.]/g, "")) * 100);
  const valido = Number.isFinite(centavos) && centavos > 0 && centavos <= saldo;

  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Registrar pago"
      descripcion="Esto emite un CFDI de pago propio, con su UUID, ligado a esta factura."
      testid="dialogo-pago">
      <div className="space-y-3">
        <div>
          <Etiqueta htmlFor="monto" nota={`saldo insoluto: ${mxn(saldo)}`}>Importe recibido</Etiqueta>
          <Campo id="monto" inputMode="decimal" value={monto} error={!!monto && !valido}
            onChange={(e) => setMonto(e.target.value)} placeholder="0.00" data-testid="monto" />
          {!!monto && !valido && (
            <p className="mt-1 text-sm text-alto" role="alert">
              El abono tiene que ser mayor que cero y no puede pasar del saldo insoluto.
            </p>
          )}
        </div>
        <div>
          <Etiqueta htmlFor="forma" nota="ya se sabe cómo se pagó, así que aquí no cabe el 99">Forma de pago</Etiqueta>
          <Selector id="forma" value={forma} onChange={(e) => setForma(e.target.value)} data-testid="forma-pago">
            {Object.entries(FORMAS_PAGO).filter(([k]) => k !== "99").map(([k, v]) => (
              <option key={k} value={k}>{k} — {v}</option>
            ))}
          </Selector>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="contorno" className="px-2.5 text-xs" data-testid="abonar-todo"
            onClick={() => setMonto((saldo / 100).toFixed(2))}>
            Liquidar todo ({mxn(saldo)})
          </Boton>
          <Boton variante="contorno" className="px-2.5 text-xs"
            onClick={() => setMonto((Math.floor(saldo / 2) / 100).toFixed(2))}>
            La mitad
          </Boton>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
          <Boton disabled={!valido || ocupado} data-testid="confirmar-pago"
            onClick={() => alConfirmar(centavos, forma)}>
            {ocupado ? "Timbrando…" : "Timbrar complemento"}
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

function xmlDe(
  f: NonNullable<ReturnType<typeof api.facturaDe>>,
  rfcEmisor: string, regimen: string, rfcReceptor: string, nombreReceptor: string, cpReceptor: string,
): string {
  const n = (c: number) => (c / 100).toFixed(2);
  const timbre = f.uuid
    ? `
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="${f.uuid}"
      FechaTimbrado="${f.timbradaEn}" NoCertificadoSAT="00001000000504465028"
      SelloSAT="${sello(f.uuid, 64)}…"/>
  </cfdi:Complemento>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante Version="4.0" Serie="${f.serie}" Folio="${f.folio}"
  Fecha="${f.fecha.slice(0, 19)}" FormaPago="${f.formaPago}" MetodoPago="${f.metodoPago}"
  SubTotal="${n(f.subtotal)}" Total="${n(f.total)}" Moneda="MXN"
  TipoDeComprobante="I" Exportacion="01" LugarExpedicion="06700">
  <cfdi:Emisor Rfc="${rfcEmisor}" RegimenFiscal="${regimen}"/>
  <cfdi:Receptor Rfc="${rfcReceptor}" Nombre="${nombreReceptor}"
    DomicilioFiscalReceptor="${cpReceptor}" UsoCFDI="${f.usoCFDI}"/>
  <cfdi:Conceptos>
${f.conceptos.map((c) => `    <cfdi:Concepto ClaveProdServ="${c.claveProdServ}" Cantidad="${c.cantidad}"
      ClaveUnidad="E48" Descripcion="${c.descripcion}"
      ValorUnitario="${n(c.valorUnitario)}" Importe="${n(c.importe)}" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="${n(c.importe)}" Impuesto="002" TipoFactor="Tasa"
            TasaOCuota="0.160000" Importe="${n(c.traslado)}"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>`).join("\n")}
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${n(f.traslados)}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${n(f.subtotal)}" Impuesto="002" TipoFactor="Tasa"
        TasaOCuota="0.160000" Importe="${n(f.traslados)}"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>${timbre}
</cfdi:Comprobante>`;
}
