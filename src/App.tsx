import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import Armazon from "@/components/Armazon";
import Entrar from "@/pages/Entrar";
import Resumen from "@/pages/Resumen";
import Facturas from "@/pages/Facturas";
import FacturaDetalle from "@/pages/FacturaDetalle";
import NuevaFactura from "@/pages/NuevaFactura";
import Complementos from "@/pages/Complementos";
import Clientes from "@/pages/Clientes";
import NoEncontrado from "@/pages/NoEncontrado";
import { useApp } from "@/estado";
import { Esqueleto } from "@/components/base";

function Protegida({ children }: { children: React.ReactNode }) {
  const { datos, cargando, usuario } = useApp();
  const local = useLocation();
  if (cargando || !datos) return <Esqueleto className="h-64" />;
  if (!usuario()) return <Navigate to="/entrar" replace state={{ de: local.pathname + local.search }} />;
  return <>{children}</>;
}

export default function App() {
  const cargar = useApp((s) => s.cargar);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <>
      <Routes>
        <Route element={<Armazon />}>
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/" element={<Protegida><Resumen /></Protegida>} />
          <Route path="/facturas" element={<Protegida><Facturas /></Protegida>} />
          <Route path="/facturas/nueva" element={<Protegida><NuevaFactura /></Protegida>} />
          <Route path="/facturas/:id" element={<Protegida><FacturaDetalle /></Protegida>} />
          <Route path="/complementos" element={<Protegida><Complementos /></Protegida>} />
          <Route path="/clientes" element={<Protegida><Clientes /></Protegida>} />
          <Route path="*" element={<NoEncontrado />} />
        </Route>
      </Routes>
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
