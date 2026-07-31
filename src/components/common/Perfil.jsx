import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import { notify } from "../../utils/notify";
import { buscarActualizacion } from "../../utils/appUpdate";
import { probar as probarPush } from "../../services/pushService";
import { subirAvatarUsuario, quitarAvatarUsuario } from "../../services/supabase/avatarService";
import { subirBannerUsuario, quitarBannerUsuario } from "../../services/supabase/bannerService";
import { formatFechaIngreso, formatFechaCumpleanos, formatAntiguedadEmpleado } from "../../utils/helpers";
import { normalizeSucursal } from "../../utils/constants";
import Card from "./Card";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import SelectorColor from "../settings/SelectorColor";
import PermisosDispositivo from "../settings/PermisosDispositivo";
import { mensajeDeFallo } from "../../utils/errores";

// Etiqueta legible del rol (no hay un mapa central; local y pequeño).
const ROLE_LABEL = {
  admin: "Administración",
  rh: "Recursos Humanos",
  psicologa: "Psicóloga",
  empleado: "Colaborador",
};

// Cada usuario ve su propia info (solo lectura) y gestiona SU foto. La subida usa
// avatarService (mismo patrón que Expediente Integral) pero con el id propio; la
// RLS de self-service (migración 025) permite el archivo/columna propios.
export default function Perfil() {
  const { user, setUser } = useAuth();
  const { setUsuarios } = useGlobal();
  const { toast } = useNotification();
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [subiendoBanner, setSubiendoBanner] = useState(false);
  const [buscandoUpdate, setBuscandoUpdate] = useState(false);
  const [probando, setProbando] = useState(false);

  // Prueba de notificación: se manda un push a UNO MISMO y se reporta el resultado exacto, para
  // confirmar que este teléfono recibe.
  const enviarPrueba = async () => {
    setProbando(true);
    try {
      const { enviados, motivo } = await probarPush();
      if (enviados > 0) {
        toast.success(`Enviado a ${enviados} ${enviados === 1 ? "dispositivo" : "dispositivos"}. Revisa la bandeja de tu teléfono.`);
      } else if (motivo) {
        toast.error(`No se pudo: ${motivo}.`);
      } else {
        toast.info("Este dispositivo no está suscrito. Abre la app instalada en tu teléfono y acepta las notificaciones.");
      }
    } catch (e) {
      toast.error(e?.message || "No se pudo enviar la prueba.");
    } finally {
      setProbando(false);
    }
  };

  if (!user) return null;

  // Escape hatch manual: el chequeo automático (cada 10min + al volver del background,
  // en main.jsx) puede tardar en notar una versión nueva si el celular no vuelve a
  // primer plano seguido. Este botón fuerza el mismo chequeo ya, sin esperar.
  const handleBuscarActualizacion = async () => {
    setBuscandoUpdate(true);
    try {
      await buscarActualizacion();
    } catch (error) {
      setBuscandoUpdate(false);
      toast.error(mensajeDeFallo("No se pudo comprobar si hay una versión nueva.", error));
    }
  };

  const propagarAvatar = (avatarUrl) => {
    setUser((prev) => (prev ? { ...prev, avatarUrl } : prev));
    setUsuarios((prev) => prev.map((u) => (u.id === user.id ? { ...u, avatarUrl } : u)));
  };

  const handleCambiarFoto = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite reelegir el mismo archivo luego
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const nuevaUrl = await subirAvatarUsuario(user.id, archivo);
      propagarAvatar(nuevaUrl);
      toast.success("Foto de perfil actualizada.");
    } catch (error) {
      toast.error(error.message || "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleQuitarFoto = async () => {
    const ok = await notify.confirm({
      title: "Quitar foto de perfil",
      description: "¿Seguro que quieres quitar tu foto de perfil?",
      variant: "warning",
      confirmText: "Quitar foto",
    });
    if (!ok) return;
    setSubiendoFoto(true);
    try {
      await quitarAvatarUsuario(user.id);
      propagarAvatar(null);
      toast.success("Foto de perfil eliminada.");
    } catch (error) {
      toast.error(error.message || "No se pudo quitar la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const propagarBanner = (bannerUrl) => {
    setUser((prev) => (prev ? { ...prev, bannerUrl } : prev));
    setUsuarios((prev) => prev.map((u) => (u.id === user.id ? { ...u, bannerUrl } : u)));
  };

  const handleCambiarBanner = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setSubiendoBanner(true);
    try {
      const nuevaUrl = await subirBannerUsuario(user.id, archivo);
      propagarBanner(nuevaUrl);
      toast.success("Portada actualizada.");
    } catch (error) {
      toast.error(error.message || "No se pudo subir la portada.");
    } finally {
      setSubiendoBanner(false);
    }
  };

  const handleQuitarBanner = async () => {
    const ok = await notify.confirm({
      title: "Quitar portada",
      description: "¿Seguro que quieres volver a la portada de color?",
      variant: "warning",
      confirmText: "Quitar portada",
    });
    if (!ok) return;
    setSubiendoBanner(true);
    try {
      await quitarBannerUsuario(user.id);
      propagarBanner(null);
      toast.success("Portada eliminada.");
    } catch (error) {
      toast.error(error.message || "No se pudo quitar la portada.");
    } finally {
      setSubiendoBanner(false);
    }
  };

  const rolLabel = ROLE_LABEL[user.role] || user.role;
  const info = [
    { icon: "user", label: "Usuario", value: user.user },
    { icon: "building", label: "Sucursal", value: normalizeSucursal(user.sucursal) || "No registrada" },
    { icon: "award", label: "Puesto", value: user.puesto || "No registrado" },
    { icon: "bell", label: "Teléfono", value: user.telefono || "No registrado" },
    { icon: "message", label: "Correo", value: user.email || "No registrado" },
    { icon: "calendar", label: "Fecha de ingreso", value: formatFechaIngreso(user.fechaIngreso) },
    { icon: "clock", label: "Antigüedad", value: formatAntiguedadEmpleado(user) },
    { icon: "cake", label: "Cumpleaños", value: formatFechaCumpleanos(user.fechaCumpleanos) },
  ];

  return (
    <div className="admin-page perfil-page">
      <div className="perfil-hero2">
        {/* La capa de la portada queda decorativa; los controles van en un hermano para
            que sí los lea un lector de pantalla. */}
        <div
          className={`perfil-cover${user.bannerUrl ? " perfil-cover--imagen" : ""}`}
          style={user.bannerUrl ? { backgroundImage: `url("${user.bannerUrl}")` } : undefined}
          aria-hidden="true"
        />
        <div className="perfil-cover-actions">
          <label className="perfil-cover-btn" aria-disabled={subiendoBanner}>
            <Icon name={subiendoBanner ? "clock" : "camera"} size={14} />
            {subiendoBanner ? "Subiendo…" : (user.bannerUrl ? "Cambiar portada" : "Subir portada")}
            <input type="file" accept="image/*" hidden disabled={subiendoBanner} onChange={handleCambiarBanner} />
          </label>
          {user.bannerUrl && (
            <button
              type="button"
              className="perfil-cover-btn"
              disabled={subiendoBanner}
              onClick={handleQuitarBanner}
            >
              <Icon name="minus" size={14} /> Quitar
            </button>
          )}
        </div>
        <div className="perfil-hero2-row">
          <div className="perfil-avatar2">
            <Avatar name={user.name} size={120} color="var(--mc-verde)" photoUrl={user.avatarUrl} />
            <span className="perfil-verif" aria-hidden="true"><Icon name="check" size={18} /></span>
          </div>
          <div className="perfil-hero2-id">
            <div className="perfil-hero2-nombre-row">
              <h2 className="perfil-name">{user.name}</h2>
              <span className="perfil-role-badge">{rolLabel}</span>
            </div>
            <p className="perfil-hero2-email">
              {user.email || user.puesto || normalizeSucursal(user.sucursal) || ""}
            </p>
          </div>
          <div className="perfil-hero2-actions">
            <label className="perfil-foto-btn perfil-foto-btn--primary" aria-disabled={subiendoFoto}>
              <Icon name={subiendoFoto ? "clock" : "camera"} size={15} />
              {subiendoFoto ? "Subiendo..." : (user.avatarUrl ? "Cambiar foto" : "Subir foto")}
              <input type="file" accept="image/*" hidden disabled={subiendoFoto} onChange={handleCambiarFoto} />
            </label>
            {user.avatarUrl && (
              <button type="button" className="perfil-foto-btn perfil-foto-btn--ghost" disabled={subiendoFoto} onClick={handleQuitarFoto}>
                <Icon name="minus" size={15} /> Quitar foto
              </button>
            )}
          </div>
        </div>
      </div>

      <Card className="perfil-info-card">
        <div className="perfil-info-title">
          <Icon name="folder" size={16} />
          <span>Información</span>
        </div>
        <div className="perfil-info-grid">
          {info.map((item) => (
            <div key={item.label} className="perfil-info-item">
              <span className="perfil-info-icon"><Icon name={item.icon} size={16} /></span>
              <div className="perfil-info-text">
                <span className="perfil-info-label">{item.label}</span>
                <span className="perfil-info-value">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="perfil-info-note">
          <Icon name="lock" size={13} />
          Para cambiar tus datos (nombre, puesto, sucursal…) contacta a Recursos Humanos.
        </p>
      </Card>

      <SelectorColor />

      <PermisosDispositivo />

      <Card className="perfil-info-card">
        <div className="perfil-info-title">
          <Icon name="refresh" size={16} />
          <span>Actualizaciones</span>
        </div>
        <p className="perfil-info-note" style={{ marginBottom: 12 }}>
          La app se actualiza sola en segundo plano. Si notas algo raro o quieres forzar la
          última versión ya, presiona el botón.
        </p>
        <button
          type="button"
          className="perfil-foto-btn perfil-foto-btn--ghost"
          disabled={buscandoUpdate}
          onClick={handleBuscarActualizacion}
        >
          <Icon name="refresh" size={15} />
          {buscandoUpdate ? "Buscando..." : "Buscar actualización"}
        </button>
      </Card>

      <Card className="perfil-info-card">
        <div className="perfil-info-title">
          <Icon name="bell" size={16} />
          <span>Notificaciones</span>
        </div>
        <p className="perfil-info-note" style={{ marginBottom: 12 }}>
          ¿No te llegan las notificaciones al teléfono? Manda una de prueba a este dispositivo.
          Antes, asegúrate de tener la app instalada y de haber aceptado las notificaciones.
        </p>
        <button
          type="button"
          className="perfil-foto-btn perfil-foto-btn--ghost"
          disabled={probando}
          onClick={enviarPrueba}
        >
          <Icon name="bell" size={15} />
          {probando ? "Enviando..." : "Enviar notificación de prueba"}
        </button>
      </Card>
    </div>
  );
}
