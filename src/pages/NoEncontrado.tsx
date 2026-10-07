import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export default function NoEncontrado({ mensaje }: { mensaje?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <FileQuestion className="size-10 text-tinta-tenue" aria-hidden />
      <h1 className="text-xl font-bold">No encontrado</h1>
      <p className="max-w-md text-sm text-tinta-media">
        {mensaje ?? "La dirección que abrió no corresponde a ninguna pantalla del sistema."}
      </p>
      <Link to="/" className="mt-1 inline-flex min-h-10 items-center rounded-sm bg-archivo px-4 text-sm font-semibold text-white hover:bg-archivo/90">
        Ir al resumen
      </Link>
    </div>
  );
}
