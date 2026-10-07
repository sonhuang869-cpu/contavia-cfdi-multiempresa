import { Link } from "react-router-dom";
import { Esqueleto, Importe, Sello, Vacio } from "@/components/base";
import { useApp } from "@/estado";
import * as api from "@/lib/api";
import { limiteComplemento } from "@/lib/fiscal";
import { fecha, folioCompleto, FORMAS_PAGO, mxn } from "@/lib/tipos";

export default function Complementos() {
  const { datos, cargando, empresa } = useApp();
  const e = empresa();
  if (cargando || !datos || !e) return <div className="space-y-3"><Esqueleto className="h-10" /><Esqueleto className="h-64" /></div>;

  const pagos = api.pagosDe(datos, e.id);
  const facturas = api.facturasDe(datos, e.id);
  const clientes = api.clientesDe(datos, e.id);
  const total = pagos.filter((p) => p.estado === "vigente").reduce((s, p) => s + p.monto, 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Complementos de pago</h1>
        <p className="text-sm text-tinta-media">
          Cada abono a una factura PPD es un CFDI propio. Cobrado vigente:{" "}
          <span className="mono font-semibold">{mxn(total)}</span>.
        </p>
      </header>

      {pagos.length === 0 ? (
        <Vacio titulo="Todavía no hay complementos">
          Aparecen al registrar un pago en una factura emitida en parcialidades.
        </Vacio>
      ) : (
        <div className="overflow-x-auto rounded-md border border-linea">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Complementos de recepción de pagos</caption>
            <thead className="bg-papel text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Factura</th>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 text-right font-semibold">Parc.</th>
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Forma</th>
                <th className="px-3 py-2 text-right font-semibold">Abono</th>
                <th className="px-3 py-2 text-right font-semibold">Insoluto</th>
                <th className="px-3 py-2 font-semibold">Plazo</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody data-testid="tabla-complementos">
              {pagos.map((p) => {
                const f = facturas.find((x) => x.id === p.facturaId);
                const c = clientes.find((x) => x.id === f?.clienteId);
                return (
                  <tr key={p.id} className="border-t border-linea hover:bg-papel" data-estado={p.estado}>
                    <td className="px-3 py-0.5">
                      {f && (
                        <Link to={`/facturas/${f.id}`}
                          className="clave -mx-1 flex min-h-10 items-center rounded-xs px-1 font-semibold text-archivo hover:underline">
                          {folioCompleto(f)}
                        </Link>
                      )}
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-2">{c?.nombre ?? "—"}</td>
                    <td className="mono px-3 py-2 text-right">{p.parcialidad}</td>
                    <td className="mono px-3 py-2 whitespace-nowrap text-tinta-media">{fecha(p.fecha)}</td>
                    <td className="px-3 py-2 text-xs">{p.formaPago} — {FORMAS_PAGO[p.formaPago]}</td>
                    <td className="px-3 py-2 text-right"><Importe>{mxn(p.monto)}</Importe></td>
                    <td className="mono px-3 py-2 text-right text-tinta-media">{mxn(p.saldoInsoluto)}</td>
                    <td className="mono px-3 py-2 whitespace-nowrap text-xs text-tinta-tenue">{fecha(limiteComplemento(p.fecha))}</td>
                    <td className="px-3 py-2">
                      {p.estado === "vigente"
                        ? <Sello tono="vigente">vigente</Sello>
                        : <Sello tono="alto">cancelado {p.motivoCancelacion}</Sello>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
