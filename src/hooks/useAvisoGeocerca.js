import { useEffect, useState } from "react";
import { getSucursales } from "../services/supabase/sucursalesService";

/**
 * Avisa a recepción cuando su clínica todavía no tiene ubicación registrada.
 *
 * POR QUÉ NO BASTA CON LA NOTIFICACIÓN: el 31 de julio se le mandó la campanita a las 25
 * recepcionistas con la clínica sin ubicar. Un día después, 7 de las 9 que siguen pendientes
 * ni la habían abierto — y solo 4 de esas 9 tienen push, así que a las demás ni les sonó.
 * Una campanita se ignora; un aviso en la portada de su propia pantalla, no.
 *
 * NO SE PUEDE CERRAR a propósito: mientras la clínica no tenga ubicación, sus checadas quedan
 * marcadas 'sin_geocerca'. Desaparece solo cuando el dato está puesto, que es justo el momento
 * en que deja de hacer falta.
 *
 * Si la sucursal de la persona no aparece en la tabla (nombre mal escrito, o sin sucursal
 * asignada) NO se enseña nada: sería un aviso perpetuo que quien lo ve no puede quitar.
 */
export const useAvisoGeocerca = (user) => {
  // Derivado, no estado: apagar el aviso con un setState dentro del efecto provoca un render
  // en cascada (y eslint lo marca). Además así, si la persona pierde el permiso, el aviso se
  // va en el mismo render sin esperar a que ningún efecto lo limpie.
  const habilitado = Boolean(user?.puedeUbicarSucursal && user?.sucursal);
  const [sucursal, setSucursal] = useState(null);

  useEffect(() => {
    if (!habilitado) return undefined;
    let vivo = true;
    getSucursales()
      .then((rows) => {
        if (vivo) setSucursal(rows.find((s) => s.nombre === user.sucursal) || null);
      })
      .catch(() => { if (vivo) setSucursal(null); }); // ante la duda, no molestar
    return () => { vivo = false; };
  }, [habilitado, user?.sucursal]);

  return {
    faltaGeocerca: habilitado && Boolean(sucursal && !sucursal.tieneGeocerca),
    nombreClinica: sucursal?.nombre || "",
  };
};
