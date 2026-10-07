import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Building2, FileText, LayoutDashboard, LogOut, Menu, Receipt, RotateCcw, Users, X } from "lucide-react";
import { useApp } from "@/estado";
import { ROL_ETIQUETA } from "@/lib/tipos";
import { cx } from "@/lib/cx";

const ENLACES = [
  { a: "/", texto: "Resumen", Icono: LayoutDashboard },
  { a: "/facturas", texto: "Facturas", Icono: FileText },
  { a: "/complementos", texto: "Complementos", Icono: Receipt },
  { a: "/clientes", texto: "Clientes", Icono: Users },
];

export default function Armazon() {
  const { usuario, empresa, datos, salir, cambiarEmpresa, restaurar } = useApp();
  const u = usuario();
  const e = empresa();
  const navegar = useNavigate();
  const [menu, setMenu] = useState(false);

  const misEmpresas = datos?.empresas.filter((x) => u?.empresas.includes(x.id)) ?? [];

  const cerrar = async () => {
    await salir();
    navegar("/entrar");
    toast.success("Sesión cerrada.");
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-linea bg-papel/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:gap-3">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
            <span className="grid size-7 place-items-center rounded-xs bg-archivo text-xs text-white">C</span>
            Contavia
          </Link>

          {u && misEmpresas.length > 0 && (
            <label className="flex min-w-0 items-center gap-1.5 sm:ml-2">
              <Building2 className="size-4 shrink-0 text-tinta-tenue" aria-hidden />
              <span className="sr-only">Empresa activa</span>
              <select
                value={e?.id ?? ""}
                onChange={async (ev) => {
                  await cambiarEmpresa(ev.target.value);
                  toast.success("Empresa cambiada.");
                  navegar("/");
                }}
                data-testid="selector-empresa"
                className="min-h-9 w-full min-w-0 max-w-[8.5rem] truncate rounded-sm border border-linea bg-tarjeta px-2 text-xs font-semibold focus:border-archivo focus:outline-none sm:max-w-[14rem]"
              >
                {misEmpresas.map((x) => (
                  <option key={x.id} value={x.id}>{x.nombre}</option>
                ))}
              </select>
            </label>
          )}

          <nav className="ml-3 hidden gap-0.5 lg:flex" aria-label="Principal">
            {ENLACES.map(({ a, texto }) => (
              <NavLink
                key={a}
                to={a}
                end={a === "/"}
                className={({ isActive }) =>
                  cx("rounded-sm px-2.5 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-archivo-claro text-archivo" : "text-tinta-media hover:text-tinta")
                }
              >
                {texto}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {u && (
              <div className="hidden text-right md:block">
                <p className="text-xs leading-tight font-semibold" data-testid="usuario">{u.nombre}</p>
                <p className="text-[11px] text-tinta-media">{ROL_ETIQUETA[u.rol]}</p>
              </div>
            )}
            <button
              onClick={async () => { await restaurar(); navegar("/entrar"); toast.success("Demostración restaurada."); }}
              aria-label="Restaurar demostración" title="Restaurar demostración" data-testid="restaurar"
              className="hidden size-9 place-items-center rounded-sm text-tinta-tenue hover:text-tinta sm:grid"
            >
              <RotateCcw className="size-4" aria-hidden />
            </button>
            {u && (
              <button onClick={cerrar} data-testid="salir" aria-label="Cerrar sesión"
                className="hidden size-9 place-items-center rounded-sm text-tinta-tenue hover:text-tinta lg:grid">
                <LogOut className="size-4" aria-hidden />
              </button>
            )}
            <button
              onClick={() => setMenu((v) => !v)}
              aria-label={menu ? "Cerrar menú" : "Abrir menú"} aria-expanded={menu} data-testid="menu"
              className="grid size-9 place-items-center rounded-sm border border-linea lg:hidden"
            >
              {menu ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
            </button>
          </div>
        </div>

        {menu && (
          <nav className="border-t border-linea bg-tarjeta lg:hidden" data-testid="menu-movil" aria-label="Principal">
            <ul className="mx-auto max-w-6xl px-2 py-1.5">
              {ENLACES.map(({ a, texto, Icono }) => (
                <li key={a}>
                  <NavLink to={a} end={a === "/"} onClick={() => setMenu(false)}
                    className={({ isActive }) =>
                      cx("flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm font-medium",
                        isActive ? "bg-archivo-claro text-archivo" : "text-tinta-media")}>
                    <Icono className="size-4" aria-hidden /> {texto}
                  </NavLink>
                </li>
              ))}
              {u && (
                <li className="mt-1 border-t border-linea pt-1">
                  <button onClick={() => { setMenu(false); cerrar(); }} data-testid="salir-movil"
                    className="flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-sm text-tinta-media">
                    <LogOut className="size-4" aria-hidden /> Cerrar sesión
                  </button>
                </li>
              )}
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
        <Outlet />
      </main>

      <footer className="border-t border-linea px-4 py-5">
        <p className="mx-auto max-w-6xl text-[11px] leading-relaxed text-tinta-tenue">
          Demostración para evaluación. Las empresas, los RFC, los clientes y los importes son
          inventados; los UUID y los sellos se generan localmente y no provienen de ningún PAC. No se
          llama a ningún proveedor de timbrado ni al SAT. Lo que sí es real es la regla: el cálculo
          del IVA por concepto, el encadenamiento de parcialidades, los motivos de cancelación y el
          aislamiento entre empresas. Justin Gnoh · octubre de 2026
        </p>
      </footer>
    </div>
  );
}
