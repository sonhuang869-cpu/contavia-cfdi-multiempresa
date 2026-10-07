import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Aviso, Boton, Campo, Error, Esqueleto, Etiqueta, Importe, Selector } from "@/components/base";
import { useApp } from "@/estado";
import * as api from "@/lib/api";
import { ReglaError } from "@/lib/api";
import { calcularConcepto, totalesDe, trasladoIngenuo } from "@/lib/fiscal";
import { FORMAS_PAGO, mxn, USOS_CFDI, type MetodoPago } from "@/lib/tipos";

interface Linea { clave: string; descripcion: string; cantidad: string; unitario: string }

const VACIA: Linea = { clave: "81111500", descripcion: "", cantidad: "1", unitario: "" };

/** Pesos escritos a mano → centavos enteros, una sola vez, en la orilla. */
const aCentavos = (texto: string): number => {
  const limpio = texto.replace(/[^\d.,]/g, "").replace(/,/g, "");
  const n = Number(limpio);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export default function NuevaFactura() {
  const { datos, cargando, empresa, refrescar } = useApp();
  const navegar = useNavigate();
  const e = empresa();

  const [clienteId, setClienteId] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("PUE");
  const [forma, setForma] = useState("03");
  const [uso, setUso] = useState("G03");
  const [lineas, setLineas] = useState<Linea[]>([{ ...VACIA }]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  if (cargando || !datos || !e) return <div className="space-y-3"><Esqueleto className="h-10" /><Esqueleto className="h-80" /></div>;
  const clientes = api.clientesDe(datos, e.id);

  const conceptos = lineas.map((l) => {
    const cantidad = Number(l.cantidad);
    const unitario = aCentavos(l.unitario);
    if (!(cantidad > 0) || !Number.isFinite(unitario) || unitario <= 0) return { importe: 0, traslado: 0 };
    return calcularConcepto(cantidad, unitario);
  });
  const t = totalesDe(conceptos);
  const ingenuo = trasladoIngenuo(t.subtotal);

  const cambiar = (i: number, campo: keyof Linea, valor: string) =>
    setLineas((ls) => ls.map((l, k) => (k === i ? { ...l, [campo]: valor } : l)));

  // PPD se emite sin saber cómo se va a pagar; por eso la forma queda en 99.
  const cambiarMetodo = (m: MetodoPago) => {
    setMetodo(m);
    setForma(m === "PPD" ? "99" : "03");
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const nuevos: Record<string, string> = {};
    if (!clienteId) nuevos.cliente = "Elija el cliente receptor.";
    lineas.forEach((l, i) => {
      if (!l.descripcion.trim()) nuevos[`l-${i}`] = "Falta la descripción.";
      else if (!(Number(l.cantidad) > 0)) nuevos[`l-${i}`] = "La cantidad tiene que ser mayor que cero.";
      else if (!(aCentavos(l.unitario) > 0)) nuevos[`l-${i}`] = "El valor unitario tiene que ser mayor que cero.";
    });
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setEnviando(true);
    try {
      const f = await api.crearFactura(e.id, {
        clienteId, metodoPago: metodo, formaPago: forma, usoCFDI: uso,
        lineas: lineas.map((l) => ({
          claveProdServ: l.clave, descripcion: l.descripcion,
          cantidad: Number(l.cantidad), valorUnitario: aCentavos(l.unitario),
        })),
      });
      await refrescar();
      toast.success("Factura creada como borrador. Falta timbrarla.");
      navegar(`/facturas/${f.id}`);
    } catch (err) {
      setErrores({ cliente: err instanceof ReglaError ? err.message : "No fue posible crear la factura." });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Nueva factura</h1>
      <p className="mt-1 text-sm text-tinta-media">
        Se guarda como borrador. El UUID aparece sólo cuando se timbra.
      </p>

      <form onSubmit={enviar} className="mt-5 space-y-5" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Etiqueta htmlFor="cliente">Cliente receptor</Etiqueta>
            <Selector id="cliente" value={clienteId} onChange={(ev) => setClienteId(ev.target.value)} data-testid="cliente">
              <option value="">Seleccione…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.rfc}</option>)}
            </Selector>
            {errores.cliente && <Error>{errores.cliente}</Error>}
          </div>
          <div>
            <Etiqueta htmlFor="metodo" nota="PPD obliga a complemento por cada abono">Método de pago</Etiqueta>
            <Selector id="metodo" value={metodo} onChange={(ev) => cambiarMetodo(ev.target.value as MetodoPago)} data-testid="metodo">
              <option value="PUE">PUE — pago en una sola exhibición</option>
              <option value="PPD">PPD — pago en parcialidades o diferido</option>
            </Selector>
          </div>
          <div>
            <Etiqueta htmlFor="forma">Forma de pago</Etiqueta>
            <Selector id="forma" value={forma} onChange={(ev) => setForma(ev.target.value)}
              disabled={metodo === "PPD"} data-testid="forma">
              {Object.entries(FORMAS_PAGO)
                .filter(([k]) => (metodo === "PPD" ? k === "99" : k !== "99"))
                .map(([k, v]) => <option key={k} value={k}>{k} — {v}</option>)}
            </Selector>
          </div>
          <div className="sm:col-span-2">
            <Etiqueta htmlFor="uso">Uso del CFDI</Etiqueta>
            <Selector id="uso" value={uso} onChange={(ev) => setUso(ev.target.value)} data-testid="uso">
              {Object.entries(USOS_CFDI).map(([k, v]) => <option key={k} value={k}>{k} — {v}</option>)}
            </Selector>
          </div>
        </div>

        {metodo === "PPD" && (
          <Aviso testid="aviso-ppd">
            En PPD la forma de pago se queda en 99, «por definir», porque al emitir todavía no se
            sabe cómo va a pagar el cliente. Cada abono que reciba después genera su propio CFDI de
            pago, que se emite a más tardar el día cinco del mes siguiente.
          </Aviso>
        )}

        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-tinta-media uppercase">Conceptos</legend>
          <ul className="space-y-2" data-testid="lineas">
            {lineas.map((l, i) => (
              <li key={i} className="rounded-md border border-linea bg-tarjeta p-3">
                <div className="grid gap-2 sm:grid-cols-[7rem_1fr]">
                  <Campo aria-label={`Clave del concepto ${i + 1}`} value={l.clave} className="clave"
                    onChange={(ev) => cambiar(i, "clave", ev.target.value.replace(/\D/g, ""))} data-testid={`clave-${i}`} />
                  <Campo aria-label={`Descripción del concepto ${i + 1}`} value={l.descripcion} placeholder="Descripción del bien o servicio"
                    onChange={(ev) => cambiar(i, "descripcion", ev.target.value)} data-testid={`descripcion-${i}`} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-tinta-media">
                    Cantidad
                    <Campo aria-label={`Cantidad del concepto ${i + 1}`} inputMode="decimal" value={l.cantidad}
                      onChange={(ev) => cambiar(i, "cantidad", ev.target.value.replace(/[^\d.]/g, ""))}
                      className="w-20 text-right" data-testid={`cantidad-${i}`} />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-tinta-media">
                    Unitario
                    <Campo aria-label={`Valor unitario del concepto ${i + 1}`} inputMode="decimal" value={l.unitario}
                      onChange={(ev) => cambiar(i, "unitario", ev.target.value)} placeholder="0.00"
                      className="w-28 text-right" data-testid={`unitario-${i}`} />
                  </label>
                  <span className="mono ml-auto text-sm" data-testid={`importe-${i}`}>
                    {mxn(conceptos[i].importe)}
                    <span className="ml-2 text-xs text-tinta-tenue">IVA {mxn(conceptos[i].traslado)}</span>
                  </span>
                  <Boton type="button" variante="fantasma" className="px-2" disabled={lineas.length === 1}
                    aria-label={`Quitar concepto ${i + 1}`} data-testid={`quitar-${i}`}
                    onClick={() => setLineas((ls) => ls.filter((_, k) => k !== i))}>
                    <Trash2 className="size-4" aria-hidden />
                  </Boton>
                </div>
                {errores[`l-${i}`] && <Error>{errores[`l-${i}`]}</Error>}
              </li>
            ))}
          </ul>
          <Boton type="button" variante="contorno" className="mt-2" data-testid="agregar-linea"
            onClick={() => setLineas((ls) => [...ls, { ...VACIA }])}>
            <Plus className="size-4" aria-hidden /> Agregar concepto
          </Boton>
        </fieldset>

        <div className="rounded-md border border-linea bg-tarjeta p-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-tinta-media">Subtotal</dt><dd className="mono" data-testid="prev-subtotal">{mxn(t.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-tinta-media">IVA trasladado</dt><dd className="mono" data-testid="prev-iva">{mxn(t.traslados)}</dd></div>
            <div className="flex justify-between border-t border-linea pt-1.5">
              <dt className="font-bold">Total</dt><dd><Importe data-testid="prev-total">{mxn(t.total)}</Importe></dd>
            </div>
          </dl>
          {t.traslados !== ingenuo && (
            <p className="mt-2 text-xs text-tinta-media" data-testid="prev-centavo">
              Ojo: el IVA sumado por concepto da {mxn(t.traslados)} y calculado sobre el subtotal
              daría {mxn(ingenuo)}. Se timbra con el primero, que es el que el SAT valida.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Boton type="submit" disabled={enviando} data-testid="crear">
            {enviando ? "Guardando…" : "Guardar borrador"}
          </Boton>
          <Boton type="button" variante="fantasma" onClick={() => navegar("/facturas")}>Cancelar</Boton>
        </div>
      </form>
    </div>
  );
}
