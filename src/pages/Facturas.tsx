import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Campo, Esqueleto, Sello, Selector, Vacio } from "@/components/base";
import { useApp } from "@/estado";
import * as api from "@/lib/api";
import { saldoDe } from "@/lib/fiscal";
import { fecha, folioCompleto, mxn } from "@/lib/tipos";
import { cx } from "@/lib/cx";
import { useAngosto } from "@/lib/angosto";

export default function Facturas() {
  const { datos, cargando, empresa } = useApp();
  const [params, setParams] = useSearchParams();
  const e = empresa();
  const angosto = useAngosto();
  // La búsqueda vive en la URL, no en el componente: desde la ficha de un
  // cliente se llega aquí con ?q=, y guardarla en estado local dejaba ese
  // enlace navegando a una lista sin filtrar.
  const q = params.get("q") ?? "";

  if (cargando || !datos || !e) {
    return <div className="space-y-3"><Esqueleto className="h-10" /><Esqueleto className="h-80" /></div>;
  }

  const metodo = params.get("metodo") ?? "todos";
  const estado = params.get("estado") ?? "todos";
  const clientes = api.clientesDe(datos, e.id);
  const pagos = api.pagosDe(datos, e.id);
  const nombre = (id: string) => clientes.find((c) => c.id === id)?.nombre ?? "—";

  const lista = api.facturasDe(datos, e.id)
    .filter((f) => metodo === "todos" || f.metodoPago === metodo)
    .filter((f) => estado === "todos"
      || (estado === "borrador" ? !f.uuid : estado === "vigente" ? f.estado === "vigente" && !!f.uuid : f.estado === "cancelado"))
    .filter((f) => {
      const t = q.trim().toLowerCase();
      if (!t) return true;
      return `${folioCompleto(f)} ${nombre(f.clienteId)} ${f.uuid ?? ""}`.toLowerCase().includes(t);
    });

  const poner = (clave: string, valor: string) => {
    const p = new URLSearchParams(params);
    if (!valor || valor === "todos") p.delete(clave); else p.set(clave, valor);
    setParams(p, { replace: true });
  };
  const setQ = (valor: string) => poner("q", valor);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Facturas</h1>
          <p className="text-sm text-tinta-media">Comprobantes emitidos por {e.nombre}.</p>
        </div>
        <Link to="/facturas/nueva" data-testid="nueva-factura"
          className="inline-flex min-h-10 items-center gap-2 rounded-sm bg-archivo px-3.5 text-sm font-semibold text-white hover:bg-archivo/90">
          <Plus className="size-4" aria-hidden /> Nueva factura
        </Link>
      </header>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tinta-tenue" aria-hidden />
          <Campo value={q} onChange={(ev) => setQ(ev.target.value)} className="pl-8"
            placeholder="Folio, cliente o UUID" aria-label="Buscar facturas" data-testid="buscar" />
        </div>
        <Selector value={metodo} onChange={(ev) => poner("metodo", ev.target.value)}
          aria-label="Método de pago" data-testid="filtro-metodo" className="sm:w-40">
          <option value="todos">Todo método</option>
          <option value="PUE">PUE</option>
          <option value="PPD">PPD</option>
        </Selector>
        <Selector value={estado} onChange={(ev) => poner("estado", ev.target.value)}
          aria-label="Estado" data-testid="filtro-estado" className="sm:w-40">
          <option value="todos">Todo estado</option>
          <option value="vigente">Vigentes</option>
          <option value="cancelado">Canceladas</option>
          <option value="borrador">Borradores</option>
        </Selector>
      </div>

      {lista.length === 0 ? (
        <Vacio titulo="Ninguna factura coincide">Pruebe con otro filtro o limpie la búsqueda.</Vacio>
      ) : angosto ? (
        /* En el teléfono las siete columnas empujan el total y el estado fuera
           de la pantalla, y son justo las dos que se buscan de un vistazo. */
        <ul className="space-y-2" data-testid="tarjetas-facturas">
          {lista.map((f) => {
            const saldo = saldoDe(f, pagos);
            return (
              <li key={f.id}>
                <Link to={`/facturas/${f.id}`} data-factura={f.id} data-metodo={f.metodoPago}
                  data-estado={!f.uuid ? "borrador" : f.estado}
                  className="block rounded-md border border-linea bg-tarjeta p-3 hover:border-archivo">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="clave font-semibold text-archivo">{folioCompleto(f)}</span>
                    <span className="mono text-sm font-semibold">{mxn(f.total)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm">{nombre(f.clienteId)}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Sello tono={f.metodoPago === "PPD" ? "archivo" : "neutro"}>{f.metodoPago}</Sello>
                    {!f.uuid
                      ? <Sello>borrador</Sello>
                      : f.estado === "vigente"
                        ? <Sello tono="vigente">vigente</Sello>
                        : <Sello tono="alto">cancelada {f.motivoCancelacion}</Sello>}
                    {f.metodoPago === "PPD" && saldo > 0 && (
                      <Sello tono="importe">saldo {mxn(saldo)}</Sello>
                    )}
                    <span className="mono ml-auto text-xs text-tinta-tenue">{fecha(f.fecha)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-md border border-linea">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Facturas emitidas</caption>
            <thead className="bg-papel text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Folio</th>
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">Método</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-right font-semibold">Saldo</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody data-testid="tabla-facturas">
              {lista.map((f) => {
                const saldo = saldoDe(f, pagos);
                return (
                  <tr key={f.id} className="border-t border-linea hover:bg-papel"
                    data-factura={f.id} data-metodo={f.metodoPago}
                    data-estado={!f.uuid ? "borrador" : f.estado}>
                    <td className="px-3 py-0.5">
                      {/* el enlace ocupa el alto de la celda: en una tabla densa
                          un blanco de 13px no se toca con el dedo */}
                      <Link to={`/facturas/${f.id}`}
                        className="clave -mx-1 flex min-h-10 items-center rounded-xs px-1 font-semibold text-archivo hover:underline">
                        {folioCompleto(f)}
                      </Link>
                    </td>
                    <td className="mono px-3 py-2 whitespace-nowrap text-tinta-media">{fecha(f.fecha)}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2">{nombre(f.clienteId)}</td>
                    <td className="px-3 py-2">
                      <Sello tono={f.metodoPago === "PPD" ? "archivo" : "neutro"}>{f.metodoPago}</Sello>
                    </td>
                    <td className="mono px-3 py-2 text-right">{mxn(f.total)}</td>
                    <td className={cx("mono px-3 py-2 text-right", saldo > 0 ? "font-semibold text-importe" : "text-tinta-tenue")}>
                      {f.metodoPago === "PPD" ? mxn(saldo) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {!f.uuid
                        ? <Sello>borrador</Sello>
                        : f.estado === "vigente"
                          ? <Sello tono="vigente">vigente</Sello>
                          : <Sello tono="alto">cancelada {f.motivoCancelacion}</Sello>}
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
