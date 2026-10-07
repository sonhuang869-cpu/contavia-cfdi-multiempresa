import { create } from "zustand";
import * as api from "@/lib/api";
import type { Datos, Empresa, Usuario } from "@/lib/tipos";

interface Estado {
  datos: Datos | null;
  cargando: boolean;
  cargar: () => Promise<void>;
  refrescar: () => Promise<void>;
  usuario: () => Usuario | null;
  empresa: () => Empresa | null;
  entrar: (correo: string, contrasena: string) => Promise<Usuario>;
  salir: () => Promise<void>;
  cambiarEmpresa: (id: string) => Promise<void>;
  restaurar: () => Promise<void>;
}

export const useApp = create<Estado>((set, get) => ({
  datos: null,
  cargando: true,

  cargar: async () => {
    set({ cargando: true });
    try {
      set({ datos: await api.obtenerDatos() });
    } finally {
      set({ cargando: false });
    }
  },

  refrescar: async () => set({ datos: await api.obtenerDatos() }),

  usuario: () => {
    const d = get().datos;
    if (!d?.sesionId) return null;
    return d.usuarios.find((u) => u.id === d.sesionId) ?? null;
  },

  empresa: () => {
    const d = get().datos;
    if (!d?.empresaActivaId) return null;
    return d.empresas.find((e) => e.id === d.empresaActivaId) ?? null;
  },

  entrar: async (correo, contrasena) => {
    const u = await api.entrar(correo, contrasena);
    set({ datos: await api.obtenerDatos() });
    return u;
  },

  salir: async () => {
    await api.salir();
    set({ datos: await api.obtenerDatos() });
  },

  cambiarEmpresa: async (id) => set({ datos: await api.cambiarEmpresa(id) }),

  restaurar: async () => set({ datos: await api.restaurar() }),
}));
