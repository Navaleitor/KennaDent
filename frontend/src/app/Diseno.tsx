import * as Menu from "@radix-ui/react-dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";

import { cerrarSesion, useSalir, useSesion } from "../api/consultas/sesion";
import { BotonTema } from "../componentes/BotonTema";
import { Icono } from "../componentes/Icono";
import { Marca } from "../componentes/Marca";
import { useInactividad } from "../modulos/sesion/useInactividad";
import { iniciales, usuarioSinClinica, VERSION } from "../utilidades/texto";
import estilos from "./Diseno.module.css";
import { menuPara } from "./menu";

/** Diseño general: menú lateral (Principal y Gestión), barra superior y el contenido. */
export function Diseno() {
  const { data: sesion } = useSesion();
  const cliente = useQueryClient();
  const salir = useSalir();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const alVencer = useCallback(() => void cerrarSesion(cliente, "inactividad"), [cliente]);
  useInactividad(alVencer);

  const items = menuPara(sesion?.permisos);
  const trabajador = sesion?.trabajador;
  const sucursales = sesion?.sucursales ?? [];
  const nombreSucursal =
    sucursales.length === 0
      ? "Sin sucursal asignada"
      : sucursales.length === 1
        ? sucursales[0]?.nombre
        : `${sucursales[0]?.nombre} y ${sucursales.length - 1} más`;

  return (
    <div className={estilos.marco} data-menu-abierto={menuAbierto || undefined}>
      <aside className={estilos.lateral} aria-label="Menú principal" id="menu-lateral">
        <Marca subtitulo={sesion?.empresa?.nombre} />
        <div className={estilos.sucursal}>
          <span className={estilos.sucursalIco}>
            <Icono nombre="empresa" />
          </span>
          <div>
            <small>{sucursales.length > 1 ? "Mis sucursales" : "Mi sucursal"}</small>
            <strong>{nombreSucursal}</strong>
          </div>
        </div>
        {/* En tablet vertical y celular el menú se abre encima: se cierra al elegir una sección */}
        <nav className={estilos.nav} onClick={() => setMenuAbierto(false)}>
          {(["Principal", "Gestión"] as const).map((grupo) => {
            const delGrupo = items.filter((i) => i.grupo === grupo);
            if (delGrupo.length === 0) return null;
            return (
              <div key={grupo} className={estilos.grupo}>
                <span className={estilos.grupoTitulo}>{grupo}</span>
                {delGrupo.map((item) => (
                  <NavLink
                    key={item.ruta}
                    to={`/${item.ruta}`}
                    end
                    className={({ isActive }) =>
                      isActive ? `${estilos.enlace} ${estilos.activo}` : estilos.enlace
                    }
                  >
                    <Icono nombre={item.icono} />
                    <span>{item.nombre}</span>
                    {item.fase ? <em className={estilos.pronto}>Pronto</em> : null}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className={estilos.pie}>
          <span className={estilos.pieIco}>KD</span>
          <div>
            <strong>Sistema · Fase F0</strong>
            <small>Versión {VERSION} · datos de ejemplo</small>
          </div>
        </div>
      </aside>
      <div className={estilos.velo} onClick={() => setMenuAbierto(false)} aria-hidden="true" />

      <div className={estilos.principal}>
        <header className={estilos.barra}>
          <button
            type="button"
            className={`btn-icon sin-borde ${estilos.soloMovil}`}
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuAbierto}
            aria-controls="menu-lateral"
            onClick={() => setMenuAbierto((a) => !a)}
          >
            <Icono nombre="menu" />
          </button>
          <span className={estilos.espacio} />
          <BotonTema />
          <Menu.Root>
            <Menu.Trigger className={estilos.usuario} aria-label="Menú de usuario">
              <span className="avatar">{iniciales(trabajador?.nombre)}</span>
              <span className={estilos.usuarioTxt}>
                <strong>{trabajador?.nombre ?? sesion?.login}</strong>
                <small>{trabajador?.puesto_nombre}</small>
              </span>
              <Icono nombre="abajo" tamano={16} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className={estilos.menuUsuario} align="end" sideOffset={6}>
                <div className={estilos.menuCabeza}>
                  <strong>{trabajador?.nombre}</strong>
                  <small className="mono">{usuarioSinClinica(sesion?.login)}</small>
                </div>
                <Menu.Item className={estilos.menuItem} onSelect={() => navegar("/cambiar-contrasena")}>
                  <Icono nombre="candado" /> Cambiar contraseña
                </Menu.Item>
                <Menu.Separator className={estilos.menuSeparador} />
                <Menu.Item className={estilos.menuItem} onSelect={() => salir.mutate()}>
                  <Icono nombre="salir" /> Salir
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </header>
        <main className={estilos.contenido} id="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
