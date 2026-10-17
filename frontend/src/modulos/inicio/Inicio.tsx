import { useLocation } from "react-router";

import { useSesion, useSucursales } from "../../api/consultas/sesion";
import { Icono } from "../../componentes/Icono";
import { iniciales, ORDEN_GRUPOS, usuarioSinClinica } from "../../utilidades/texto";
import estilos from "./Inicio.module.css";

/** Página de inicio de la F0: quién soy, mis sucursales y mis permisos (GET /api/v1/sesion/). */
export function Inicio() {
  const { data: sesion } = useSesion();
  const sucursalesApi = useSucursales();
  const { state } = useLocation() as { state: { passwordCambiada?: boolean } | null };

  const trabajador = sesion?.trabajador;
  const sillones = new Map(
    (sucursalesApi.data ?? []).map((s) => [s.id, s.unidades.filter((u) => u.activo).length]),
  );

  const orden = (grupo: string) => {
    const i = ORDEN_GRUPOS.indexOf(grupo);
    return i === -1 ? ORDEN_GRUPOS.length : i;
  };
  const grupos = new Map<string, { id: string; nombre: string }[]>();
  for (const permiso of sesion?.permisos_detalle ?? []) {
    grupos.set(permiso.grupo, [...(grupos.get(permiso.grupo) ?? []), permiso]);
  }

  return (
    <>
      <div className={estilos.cabeza}>
        <div>
          <span className="eyebrow">{sesion?.empresa?.nombre}</span>
          <h1>Hola, {trabajador?.nombre}</h1>
          <p>Esto es lo que tienes habilitado en KennaDent.</p>
        </div>
      </div>

      {state?.passwordCambiada ? (
        <div className={`aviso info ${estilos.avisoArriba}`} role="status">
          <Icono nombre="check" />
          <span>Tu contraseña se guardó. A partir de ahora entra con la nueva.</span>
        </div>
      ) : null}

      <div className={estilos.rejilla}>
        <section className="card" aria-labelledby="quien-soy">
          <div className="card-head">
            <h2 id="quien-soy">Quién soy</h2>
          </div>
          <div className={`card-body ${estilos.persona}`}>
            <span className="avatar grande">{iniciales(trabajador?.nombre)}</span>
            <dl className={estilos.datos}>
              <div>
                <dt>Nombre</dt>
                <dd>{trabajador?.nombre}</dd>
              </div>
              <div>
                <dt>Puesto</dt>
                <dd>{trabajador?.puesto_nombre}</dd>
              </div>
              <div>
                <dt>Usuario</dt>
                <dd className="mono">{usuarioSinClinica(sesion?.login)}</dd>
              </div>
              <div>
                <dt>Clínica</dt>
                <dd>
                  {sesion?.empresa?.nombre} <span className="muted">({sesion?.empresa?.codigo})</span>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="card" aria-labelledby="mis-sucursales">
          <div className="card-head">
            <div>
              <h2 id="mis-sucursales">Mis sucursales</h2>
              <p>Donde el administrador te asignó.</p>
            </div>
          </div>
          <div className="card-body">
            {sesion?.sucursales?.length ? (
              <ul className={estilos.lista}>
                {sesion.sucursales.map((s) => (
                  <li key={s.id}>
                    <span className={estilos.icoSuave}>
                      <Icono nombre="empresa" />
                    </span>
                    <div>
                      <strong>{s.nombre}</strong>
                      <small>
                        {sillones.has(s.id)
                          ? `${sillones.get(s.id)} ${sillones.get(s.id) === 1 ? "sillón" : "sillones"}`
                          : " "}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Todavía no tienes sucursales asignadas. Pídeselo al administrador.</p>
            )}
            {sesion?.permisos?.includes("todas_sucursales") ? (
              <p className={`muted ${estilos.nota}`}>Además puedes ver todas las sucursales de la clínica.</p>
            ) : null}
          </div>
        </section>

        <section className={`card ${estilos.ancho}`} aria-labelledby="mis-permisos">
          <div className="card-head">
            <div>
              <h2 id="mis-permisos">Mis permisos</h2>
              <p>Los decide el administrador, persona por persona.</p>
            </div>
            <span className="chip">{sesion?.permisos?.length ?? 0} permisos</span>
          </div>
          <div className={`card-body ${estilos.permisos}`}>
            {[...grupos.entries()]
              .sort(([a], [b]) => orden(a) - orden(b))
              .map(([grupo, permisos]) => (
                <div key={grupo}>
                  <h3>{grupo}</h3>
                  <ul>
                    {permisos.map((p) => (
                      <li key={p.id}>
                        <Icono nombre="check" tamano={16} />
                        {p.nombre}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      </div>
    </>
  );
}
