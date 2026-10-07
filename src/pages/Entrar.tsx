import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { Boton, Campo, Error, Etiqueta } from "@/components/base";
import { useApp } from "@/estado";
import { ReglaError } from "@/lib/api";

const CUENTAS = [
  { rol: "Administrador", correo: "diego@albatros.mx", clave: "admin123", nota: "ve las dos empresas y puede cambiar entre ellas" },
  { rol: "Contador", correo: "norma@albatros.mx", clave: "conta123", nota: "sólo Albatros: el aislamiento empieza aquí" },
  { rol: "Facturación", correo: "ivan@albatros.mx", clave: "factura123", nota: "emite y timbra, sólo Albatros" },
];

export default function Entrar() {
  const { entrar } = useApp();
  const navegar = useNavigate();
  const local = useLocation() as { state?: { de?: string } };
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!correo.trim() || !clave) return setError("Escriba correo y contraseña.");
    setEnviando(true);
    try {
      const u = await entrar(correo, clave);
      toast.success(`Bienvenido, ${u.nombre.split(" ")[0]}.`);
      navegar(local.state?.de ?? "/", { replace: true });
    } catch (err) {
      setError(err instanceof ReglaError ? err.message : "No fue posible entrar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-bold">Entrar</h1>
      <p className="mt-1 text-sm text-tinta-media">
        Cada usuario ve sólo las empresas que tiene asignadas.
      </p>

      <form onSubmit={enviar} className="mt-6 space-y-4" noValidate>
        <div>
          <Etiqueta htmlFor="correo">Correo</Etiqueta>
          <Campo id="correo" type="email" value={correo} error={!!error}
            onChange={(ev) => setCorreo(ev.target.value)} autoComplete="username" data-testid="correo" />
        </div>
        <div>
          <Etiqueta htmlFor="clave">Contraseña</Etiqueta>
          <Campo id="clave" type="password" value={clave} error={!!error}
            onChange={(ev) => setClave(ev.target.value)} autoComplete="current-password" data-testid="clave" />
        </div>
        {error && <Error>{error}</Error>}
        <Boton type="submit" className="w-full" disabled={enviando} data-testid="entrar">
          <LogIn className="size-4" aria-hidden /> {enviando ? "Entrando…" : "Entrar"}
        </Boton>
      </form>

      <section className="mt-8 rounded-md border border-linea bg-tarjeta p-4">
        <h2 className="text-sm font-bold">Cuentas de prueba</h2>
        <p className="mt-0.5 text-xs text-tinta-media">Toque una para llenar el formulario.</p>
        <ul className="mt-3 space-y-2">
          {CUENTAS.map((c) => (
            <li key={c.correo}>
              <button type="button" onClick={() => { setCorreo(c.correo); setClave(c.clave); setError(""); }}
                data-testid={`cuenta-${c.rol.toLowerCase()}`}
                className="w-full rounded-sm border border-linea px-3 py-2 text-left hover:border-archivo">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{c.rol}</span>
                  <span className="clave text-tinta-tenue">{c.clave}</span>
                </span>
                <span className="clave block text-tinta-media">{c.correo}</span>
                <span className="block text-xs text-tinta-tenue">{c.nota}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-tinta-tenue">
          Hay una cuarta cuenta, <span className="clave">paulina@trevino.mx</span>, desactivada a
          propósito: sirve para ver que una cuenta inactiva no entra aunque la contraseña sea
          correcta.
        </p>
      </section>
    </div>
  );
}
