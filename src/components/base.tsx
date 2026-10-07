import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { X } from "lucide-react";
import { cx } from "@/lib/cx";

type Variante = "primario" | "alto" | "contorno" | "fantasma";

const VARIANTE: Record<Variante, string> = {
  primario: "bg-archivo text-white hover:bg-archivo/90",
  alto: "bg-alto text-white hover:bg-alto/90",
  contorno: "border border-linea bg-tarjeta text-tinta hover:border-tinta-tenue",
  fantasma: "text-tinta-media hover:bg-archivo-claro hover:text-tinta",
};

export function Boton({ variante = "primario", className, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-sm px-3.5 text-sm font-semibold",
        "transition-colors disabled:pointer-events-none disabled:opacity-45",
        VARIANTE[variante], className,
      )}
    />
  );
}

export function Campo({ className, error, ...props }:
  InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={error || undefined}
      className={cx(
        "min-h-10 w-full rounded-sm border bg-tarjeta px-2.5 text-sm text-tinta",
        "placeholder:text-tinta-tenue focus:outline-none",
        error ? "border-alto focus:border-alto" : "border-linea focus:border-archivo",
        className,
      )}
    />
  );
}

export function Selector({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx("min-h-10 w-full rounded-sm border border-linea bg-tarjeta px-2.5 text-sm text-tinta focus:border-archivo focus:outline-none", className)}
    />
  );
}

export function Etiqueta({ children, htmlFor, nota }: { children: ReactNode; htmlFor: string; nota?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold tracking-wide text-tinta-media uppercase">
      {children}
      {nota && <span className="mt-0.5 block text-[11px] font-normal normal-case text-tinta-tenue">{nota}</span>}
    </label>
  );
}

export function Error({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-alto" role="alert">{children}</p>;
}

type Tono = "neutro" | "archivo" | "importe" | "vigente" | "alto";
const TONO: Record<Tono, string> = {
  neutro: "border-linea bg-papel text-tinta-media",
  archivo: "border-archivo/25 bg-archivo-claro text-archivo",
  importe: "border-importe/25 bg-importe-claro text-importe",
  vigente: "border-vigente/25 bg-vigente-claro text-vigente",
  alto: "border-alto/20 bg-alto-claro text-alto",
};

export function Sello({ children, tono = "neutro", className, ...resto }:
  { children: ReactNode; tono?: Tono; className?: string } & Record<string, unknown>) {
  return (
    <span {...resto} className={cx("inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", TONO[tono], className)}>
      {children}
    </span>
  );
}

/** Los importes llevan color y tipografía propios; nada más los usa. */
export function Importe({ children, grande, className, ...resto }:
  { children: ReactNode; grande?: boolean; className?: string } & Record<string, unknown>) {
  return (
    <span {...resto} className={cx("mono font-semibold text-importe", grande ? "text-2xl" : "text-sm", className)}>
      {children}
    </span>
  );
}

export function Dialogo({ abierto, alCerrar, titulo, descripcion, children, testid, ancho = "34rem" }: {
  abierto: boolean; alCerrar: () => void; titulo: string; descripcion?: string;
  children: ReactNode; testid?: string; ancho?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      onClick={(e) => { if (e.target === ref.current) alCerrar(); }}
      style={{ width: `min(${ancho}, calc(100vw - 2rem))` }}
      className="m-auto rounded-md border border-linea bg-tarjeta p-0 text-tinta backdrop:bg-tinta/40"
      data-testid={testid}
    >
      {abierto && (
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">{titulo}</h2>
              {descripcion && <p className="mt-1 text-sm text-tinta-media">{descripcion}</p>}
            </div>
            <button onClick={alCerrar} aria-label="Cerrar" className="-m-1 rounded-sm p-1 text-tinta-tenue hover:text-tinta">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-linea px-6 py-12 text-center">
      <p className="font-semibold">{titulo}</p>
      {children && <div className="mt-1 text-sm text-tinta-media">{children}</div>}
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-sm bg-linea/70", className)} />;
}

export function Aviso({ tono = "archivo", children, testid }:
  { tono?: "archivo" | "alto" | "importe"; children: ReactNode; testid?: string }) {
  const tonos = {
    archivo: "border-archivo/25 bg-archivo-claro text-archivo",
    alto: "border-alto/20 bg-alto-claro text-alto",
    importe: "border-importe/25 bg-importe-claro text-tinta",
  } as const;
  return (
    <div className={cx("rounded-sm border px-3.5 py-2.5 text-sm", tonos[tono])} data-testid={testid}>
      {children}
    </div>
  );
}
