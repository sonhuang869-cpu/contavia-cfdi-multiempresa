import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Campo, Esqueleto, Importe, Vacio } from "@/components/base";
import { useApp } from "@/estado";
import * as api from "@/lib/api";
import { saldoDe } from "@/lib/fiscal";
import { mxn, REGIMENES } from "@/lib/tipos";

export default function Clientes() {
  const { datos, cargando, empresa } = useApp();
  const [q, setQ] = useState("");
  const e = empresa();

  if (cargando || !datos || !e) return <div className="space-y-3"><Esqueleto className="h-10" /><Esqueleto className="h-64" /></div>;

  const facturas = api.facturasDe(datos, e.id);
  const pagos = api.pagosDe(datos, e.id);
  const lista = api.clientesDe(datos, e.id).filter((c) => {
    const t = q.trim().toLowerCase();
    return !t || `${c.nombre} ${c.rfc} ${c.correo}`.toLowerCase().includes(t);
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-tinta-media">Receptores registrados de {e.nombre}.</p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tinta-tenue" aria-hidden />
        <Campo value={q} onChange={(ev) => setQ(ev.target.value)} className="pl-8"
          placeholder="Nombre, RFC o correo" aria-label="Buscar clientes" data-testid="buscar-clientes" />
      </div>

      {lista.length === 0 ? (
        <Vacio titulo={`Nada coincide con "${q.trim()}"`} />
      ) : (
        <ul className="divide-y divide-linea rounded-md border border-linea bg-tarjeta" data-testid="lista-clientes">
          {lista.map((c) => {
            const suyas = facturas.filter((f) => f.clienteId === c.id && f.uuid && f.estado === "vigente");
            const saldo = suyas.reduce((s, f) => s + saldoDe(f, pagos), 0);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.nombre}</p>
                  <p className="text-xs text-tinta-media">
                    <span className="clave">{c.rfc}</span> · régimen {c.regimenFiscal} — {REGIMENES[c.regimenFiscal]} ·
                    CP <span className="clave">{c.codigoPostal}</span>
                  </p>
                </div>
                <Link to={`/facturas?q=${encodeURIComponent(c.nombre)}`}
                  className="-mx-1 inline-flex min-h-10 items-center px-1 text-xs font-semibold text-archivo hover:underline">
                  {suyas.length} factura{suyas.length === 1 ? "" : "s"}
                </Link>
                {saldo > 0 ? <Importe>{mxn(saldo)}</Importe> : <span className="text-xs text-tinta-tenue">sin saldo</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
