import estilos from "./Marca.module.css";

/** Logo y nombre, como en el menú del prototipo. */
export function Marca({ subtitulo }: { subtitulo?: string | undefined }) {
  return (
    <div className={estilos.marca}>
      <span className={estilos.logo}>
        <img src={`${import.meta.env.BASE_URL}iconos/icono.svg`} alt="" width={42} height={42} />
      </span>
      <div className={estilos.texto}>
        <strong>KennaDent</strong>
        {subtitulo ? <small>{subtitulo}</small> : null}
      </div>
    </div>
  );
}
