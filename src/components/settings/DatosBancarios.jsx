import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import { guardarDatosBancarios } from "../../services/supabase/usuariosService";
import {
  BANCOS,
  LEYENDA_RESPONSABILIDAD,
  formatClabe,
  formatTarjeta,
  soloDigitos,
  validarClabe,
  validarTarjeta,
  LARGO_CLABE,
  LARGO_TARJETA,
} from "../../utils/bancos";
import { formatFechaHoraClinica } from "../../utils/helpers";
import Card from "../common/Card";
import Icon from "../ui/Icon";

/**
 * Captura de los datos bancarios del depósito de nómina (mig. 163), dentro de Mi perfil.
 *
 * Es el ÚNICO bloque editable de esa pantalla: todo lo demás ahí es de solo lectura y dice
 * «contacta a Recursos Humanos». Aquí es al revés a propósito — el dueño del dato es quien
 * lo mantiene, y por eso la leyenda de responsabilidad va en este bloque y no en un rincón.
 *
 * Los tres campos son opcionales POR SEPARADO: hay quien solo tiene CLABE y quien solo tiene
 * tarjeta. Se valida lo que esté lleno, no se exige llenarlo todo.
 */
export default function DatosBancarios() {
  const { user, setUser } = useAuth();
  const { setUsuarios } = useGlobal();
  const { toast } = useNotification();

  const [banco, setBanco] = useState(user?.banco || "");
  const [clabe, setClabe] = useState(user?.clabe || "");
  const [tarjeta, setTarjeta] = useState(user?.tarjeta || "");
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});

  if (!user) return null;

  // Se comparan DÍGITOS contra DÍGITOS: el estado guarda lo que se teclea (que puede traer
  // espacios del formateo) y `user` guarda lo que está en la base (solo dígitos). Sin
  // normalizar los dos lados, el botón se habilitaría solo por haber formateado.
  const hayCambios =
    (banco || "") !== (user.banco || "") ||
    soloDigitos(clabe) !== (user.clabe || "") ||
    soloDigitos(tarjeta) !== (user.tarjeta || "");

  const guardar = async () => {
    // Solo se valida lo que tiene contenido: vaciar un campo es legítimo (deja de estar
    // capturado) y no debe disparar "faltan dígitos".
    const fallos = {};
    if (soloDigitos(clabe)) {
      const r = validarClabe(clabe);
      if (!r.ok) fallos.clabe = r.motivo;
    }
    if (soloDigitos(tarjeta)) {
      const r = validarTarjeta(tarjeta);
      if (!r.ok) fallos.tarjeta = r.motivo;
    }
    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    setGuardando(true);
    try {
      const actualizado = await guardarDatosBancarios(user.id, { banco, clabe, tarjeta });

      // Se refleja lo que DEVOLVIÓ la base, no lo que se tecleó: así el sello del trigger y la
      // normalización a dígitos quedan en memoria tal como quedaron guardados.
      //
      // Se copian SOLO los cinco campos bancarios, no el objeto entero: `actualizado` viene de
      // usuariosService.mapUsuario() y el usuario de sesión lo arma el mapper de AuthContext,
      // que tiene otra forma (soporteTi, colorAcento…). Fundir uno dentro del otro funcionaría
      // hoy por casualidad y rompería el día que los dos mappers dejen de coincidir.
      const soloBancarios = {
        banco: actualizado.banco,
        clabe: actualizado.clabe,
        tarjeta: actualizado.tarjeta,
        datosBancariosActualizadoEn: actualizado.datosBancariosActualizadoEn,
        datosBancariosActualizadoPor: actualizado.datosBancariosActualizadoPor,
      };
      setUser((prev) => (prev ? { ...prev, ...soloBancarios } : prev));
      // La lista global SÍ guarda objetos de mapUsuario(), así que ahí va el completo.
      setUsuarios((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...actualizado } : u)));
      setBanco(actualizado.banco || "");
      setClabe(actualizado.clabe || "");
      setTarjeta(actualizado.tarjeta || "");
      toast.success("Datos bancarios guardados.");
    } catch (error) {
      toast.error(error?.message || "No se pudieron guardar tus datos bancarios.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="perfil-info-card">
      <div className="perfil-info-title">
        <Icon name="dollar" size={16} />
        <span>Datos bancarios para tu nómina</span>
      </div>

      <p className="perfil-info-note" style={{ marginBottom: 14 }}>
        Aquí van la cuenta a la que se te deposita. Puedes capturar tu CLABE, tu número de
        tarjeta o las dos.
      </p>

      <div className="banco-form">
        <label className="banco-campo">
          <span className="banco-campo-label">Banco</span>
          <select
            className="mc-form-select"
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            disabled={guardando}
          >
            <option value="">Selecciona tu banco</option>
            {BANCOS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>

        <label className="banco-campo">
          <span className="banco-campo-label">CLABE ({LARGO_CLABE} dígitos)</span>
          <input
            type="text"
            className={`mc-form-input${errores.clabe ? " mc-form-input--error" : ""}`}
            // inputMode numérico para que el teléfono abra el teclado de números; el type
            // sigue siendo text porque un number quita los ceros a la izquierda, y una CLABE
            // que empieza en 0 es de lo más normal.
            inputMode="numeric"
            autoComplete="off"
            placeholder="000 000 00000000000 0"
            value={formatClabe(clabe)}
            onChange={(e) => {
              setClabe(soloDigitos(e.target.value).slice(0, LARGO_CLABE));
              setErrores((p) => ({ ...p, clabe: undefined }));
            }}
            disabled={guardando}
            aria-invalid={!!errores.clabe}
          />
          {errores.clabe && <span className="banco-campo-error">{errores.clabe}</span>}
        </label>

        <label className="banco-campo">
          <span className="banco-campo-label">Número de tarjeta ({LARGO_TARJETA} dígitos)</span>
          <input
            type="text"
            className={`mc-form-input${errores.tarjeta ? " mc-form-input--error" : ""}`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000 0000 0000 0000"
            value={formatTarjeta(tarjeta)}
            onChange={(e) => {
              setTarjeta(soloDigitos(e.target.value).slice(0, LARGO_TARJETA));
              setErrores((p) => ({ ...p, tarjeta: undefined }));
            }}
            disabled={guardando}
            aria-invalid={!!errores.tarjeta}
          />
          {errores.tarjeta && <span className="banco-campo-error">{errores.tarjeta}</span>}
        </label>
      </div>

      <p className="banco-leyenda">
        <Icon name="alert" size={14} />
        <span>{LEYENDA_RESPONSABILIDAD}</span>
      </p>

      {user.datosBancariosActualizadoEn && (
        <p className="perfil-info-note">
          <Icon name="clock" size={13} />
          Última actualización: {formatFechaHoraClinica(user.datosBancariosActualizadoEn)}
        </p>
      )}

      <button
        type="button"
        className="mc-btn-primary"
        onClick={guardar}
        disabled={guardando || !hayCambios}
      >
        <Icon name="check" size={15} /> {guardando ? "Guardando…" : "Guardar datos bancarios"}
      </button>
    </Card>
  );
}
