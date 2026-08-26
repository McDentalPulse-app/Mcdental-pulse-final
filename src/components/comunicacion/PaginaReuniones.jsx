import { useState, useCallback } from "react";
import Reuniones from "./Reuniones";
import SalaJitsi from "./SalaJitsi";

/**
 * La pantalla de Reuniones, ahora con ruta propia (`/:rol/reuniones`).
 *
 * POR QUÉ EXISTE ESTE ENVOLTORIO. `Reuniones` es solo la lista; quien decide entrar a una sala
 * y ocupar la pantalla con ella era `Mensajes`, donde Reuniones vivía como pestaña. Al sacarla
 * a su propia ruta ese trabajo tenía que ir a alguna parte, y ponerlo dentro de `Reuniones`
 * habría mezclado la lista con el reproductor de vídeo. Esto es lo mismo que hacía Mensajes,
 * y nada más: guardar en qué sala estamos.
 *
 * La sala ocupa la pantalla entera, igual que antes: una videollamada en un recuadro de la
 * esquina no la usa nadie, y compartir pantalla dentro de un panel pequeño no se lee.
 */
export default function PaginaReuniones({ user }) {
  const [enSala, setEnSala] = useState(null);
  const salirDeLaSala = useCallback(() => setEnSala(null), []);

  if (enSala) return <SalaJitsi reunion={enSala} onSalir={salirDeLaSala} />;

  return (
    <div className="admin-page">
      <Reuniones user={user} onEntrar={setEnSala} />
    </div>
  );
}
