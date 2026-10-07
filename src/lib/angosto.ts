import { useEffect, useState } from "react";

/**
 * Debajo de md las tablas se vuelven tarjetas. Pintar las dos y esconder una
 * con CSS dejaría dos copias de cada control en el DOM, con la misma etiqueta;
 * esto pinta una.
 */
export function useAngosto(consulta = "(max-width: 767px)"): boolean {
  const [angosto, setAngosto] = useState(
    () => typeof window !== "undefined" && window.matchMedia(consulta).matches,
  );
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const al = () => setAngosto(m.matches);
    m.addEventListener("change", al);
    return () => m.removeEventListener("change", al);
  }, [consulta]);
  return angosto;
}
