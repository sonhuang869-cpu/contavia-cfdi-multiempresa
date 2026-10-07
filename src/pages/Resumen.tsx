import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { Aviso, Esqueleto, Importe, Sello, Vacio } from "@/components/base";
import { useApp } from "@/estado";
import * as api from "@/lib/api";
import { limiteComplemento, saldoDe } from "@/lib/fiscal";
import { fecha, folioCompleto, mxn, REGIMENES } from "@/lib/tipos";

export default function Resumen() {
  const { datos, cargando, empresa } = useApp();
  const e = empresa();
  // Un solo "hoy" por montaje. Leer el reloj en medio del render hace que dos
  // cálculos de la misma pantalla puedan caer en meses distintos.
  const [hoy] = useState(() => new Date());
  if (cargando || !datos || !e) {
    return <div className="space-y-3"><Esqueleto className="h-24" /><Esqueleto className="h-48" /></div>;
  }

  const facturas = api.facturasDe(datos, e.id);
  const pagos = api.pagosDe(datos, e.id);
  const clientes = api.clientesDe(datos, e.id);
  const vigentes = facturas.filter((f) => f.estado === "vigente" && f.uuid);

  const delMes = vigentes.filter((f) => {
    const d = new Date(f.fecha);
    return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
  });
  const facturadoMes = delMes.reduce((s, f) => s + f.subtotal, 0);
  const ivaMes = delMes.reduce((s, f) => s + f.traslados, 0);

  const conSaldo = vigentes
    .filter((f) => f.metodoPago === "PPD")
    .map((f) => ({ f, saldo: saldoDe(f, pagos) }))
    .filter((x) => x.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo);
  const porCobrar = conSaldo.reduce((s, x) => s + x.saldo, 0);

  const borradores = facturas.filter((f) => !f.uuid);

  // Pagos recibidos cuyo complemento ya debería estar timbrado. Aquí todos lo
  // están, pero el cálculo del plazo es el mismo que avisaría si no.
  const porVencer = pagos
    .filter((p) => p.estado === "vigente")
    .map((p) => ({ p, limite: limiteComplemento(p.fecha) }))
    .filter((x) => new Date(x.limite).getTime() > hoy.getTime())
    .sort((a, b) => a.limite.localeCompare(b.limite));

  const nombre = (id: string) => clientes.find((c) => c.id === id)?.nombre ?? "—";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{e.nombre}</h1>
          <p className="text-sm text-tinta-media">
            <span className="clave">{e.rfc}</span> · régimen {e.regimenFiscal} — {REGIMENES[e.regimenFiscal]} ·
            serie <span className="clave">{e.serie}</span>
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="indicadores">
        <div className="rounded-md border border-linea bg-tarjeta p-3">
          <p className="text-xs text-tinta-media">facturado del mes</p>
          <Importe grande data-testid="facturado-mes">{mxn(facturadoMes)}</Importe>
          <p className="text-xs text-tinta-tenue">{delMes.length} comprobantes, sin IVA</p>
        </div>
        <div className="rounded-md border border-linea bg-tarjeta p-3">
          <p className="text-xs text-tinta-media">IVA trasladado</p>
          <p className="mono text-2xl font-semibold" data-testid="iva-mes">{mxn(ivaMes)}</p>
          <p className="text-xs text-tinta-tenue">suma por concepto</p>
        </div>
        <div className="rounded-md border border-linea bg-tarjeta p-3">
          <p className="text-xs text-tinta-media">por cobrar</p>
          <p className="mono text-2xl font-semibold" data-testid="por-cobrar">{mxn(porCobrar)}</p>
          <p className="text-xs text-tinta-tenue">{conSaldo.length} facturas PPD abiertas</p>
        </div>
        <div className="rounded-md border border-linea bg-tarjeta p-3">
          <p className="text-xs text-tinta-media">borradores</p>
          <p className="mono text-2xl font-semibold" data-testid="borradores">{borradores.length}</p>
          <p className="text-xs text-tinta-tenue">sin timbrar</p>
        </div>
      </section>

      {conSaldo.length > 0 && (
        <Aviso testid="aviso-ppd">
          Hay {conSaldo.length} factura{conSaldo.length === 1 ? "" : "s"} en parcialidades con saldo
          abierto. Cada abono que reciba exige su complemento de pago, a más tardar el día cinco del
          mes siguiente a aquel en que se recibió.
        </Aviso>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-bold">Saldos por cobrar</h2>
          <Link to="/facturas?metodo=PPD" className="-mx-1 inline-flex min-h-10 items-center px-1 text-xs font-semibold text-archivo hover:underline">
            ver todas las PPD
          </Link>
        </div>
        {conSaldo.length === 0 ? (
          <Vacio titulo="No hay saldos abiertos">Todas las facturas en parcialidades están liquidadas.</Vacio>
        ) : (
          <ul className="divide-y divide-linea rounded-md border border-linea bg-tarjeta" data-testid="saldos">
            {conSaldo.map(({ f, saldo }) => (
              <li key={f.id}>
                {/* A 390px no caben folio, nombre, fecha, total y saldo a la vez:
                    lo que sobra se guarda, y el saldo nunca se va. */}
                <Link to={`/facturas/${f.id}`} className="flex items-center gap-2 px-3 py-2.5 hover:bg-papel sm:gap-3">
                  <span className="clave w-16 shrink-0 text-tinta-media sm:w-20">{folioCompleto(f)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{nombre(f.clienteId)}</span>
                  <span className="hidden text-xs text-tinta-tenue lg:block">{fecha(f.fecha)}</span>
                  <span className="mono hidden w-28 shrink-0 text-right text-sm text-tinta-media sm:block">{mxn(f.total)}</span>
                  <Importe className="w-24 shrink-0 text-right sm:w-28">{mxn(saldo)}</Importe>
                  <ArrowUpRight className="hidden size-4 shrink-0 text-tinta-tenue sm:block" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold">Complementos dentro del plazo</h2>
        {porVencer.length === 0 ? (
          <Vacio titulo="Nada por vencer">
            Todos los complementos de pago están emitidos y fuera de riesgo.
          </Vacio>
        ) : (
          <ul className="divide-y divide-linea rounded-md border border-linea bg-tarjeta" data-testid="por-vencer">
            {porVencer.slice(0, 5).map(({ p, limite }) => {
              const f = facturas.find((x) => x.id === p.facturaId);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                  <AlertTriangle className="size-4 shrink-0 text-importe" aria-hidden />
                  <span className="clave shrink-0 text-tinta-media">{f ? folioCompleto(f) : "—"}</span>
                  <span className="min-w-0 flex-1 truncate">parcialidad {p.parcialidad}, {mxn(p.monto)}</span>
                  <Sello tono="importe">vence {fecha(limite)}</Sello>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
