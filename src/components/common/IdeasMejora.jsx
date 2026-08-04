import { useCallback, useEffect, useState } from "react";
import Select from "./Select";
import Card from "./Card";
import PageHeader from "./PageHeader";
import EmptyState from "./EmptyState";
import SectionTitle from "./SectionTitle";
import Icon from "../ui/Icon";
import { supabase } from "../../config/supabase";
import { useNotification } from "../../contexts/NotificationContext";

const PRIORIDADES = [
  { value: "BAJA", label: "Baja · cuando se pueda" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta · nos está costando dinero o tiempo" },
];

// Los estados son las columnas del tablero de Pendientes de MCTIC (TODO / DOING / DONE). Se
// traducen a lo que significan para quien propuso la idea, no a la jerga del tablero.
const ESTADOS = {
  TODO: { label: "Recibida", pill: "mc-status-pill--nuevo" },
  DOING: { label: "En marcha", pill: "mc-status-pill--seguimiento" },
  DONE: { label: "Aplicada", pill: "mc-status-pill--aprobado" },
};

const PRIORIDAD_LABEL = { BAJA: "Baja", MEDIA: "Media", ALTA: "Alta" };

const formatoFecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

// Buzón de propuestas del personal. Cada idea entra al tablero de Pendientes de MCTIC (el
// mismo que TI mira a diario), así que no se queda en una bandeja que nadie abre; y como el
// tablero tiene columnas, quien la propuso puede ver aquí si ya está en marcha.
const IdeasMejora = ({ user }) => {
  const { toast } = useNotification();
  const [prioridad, setPrioridad] = useState("MEDIA");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ideas, setIdeas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargarIdeas = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch("/api/idea-mejora", {
      headers: { Authorization: `Bearer ${session?.access_token || ""}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || "No se pudieron consultar tus ideas.");
    return data.ideas || [];
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const lista = await cargarIdeas();
        if (activo) setIdeas(lista);
      } catch (err) {
        if (activo) toast.error(err.message || "No se pudieron consultar tus ideas.");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, [cargarIdeas, toast]);

  const enviar = async () => {
    if (!titulo.trim()) {
      toast.warning("Ponle un título a tu idea.");
      return;
    }
    setEnviando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/idea-mejora", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          title: titulo.trim(),
          description: descripcion.trim(),
          priority: prioridad,
          name: user?.name,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || "No se pudo enviar tu idea.");
      }
      setTitulo("");
      setDescripcion("");
      toast.success(`Idea enviada (folio #${data.id}). Ya está en la lista de pendientes de TI.`);
      // Si la relectura fallara, la idea ya quedó registrada: la lista se pone al día al recargar.
      const lista = await cargarIdeas().catch(() => null);
      if (lista) setIdeas(lista);
    } catch (err) {
      toast.error(err.message || "No se pudo enviar tu idea.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="admin-page empleado-page empleado-form-narrow">
      <PageHeader
        icon="lightbulb"
        title="Ideas de mejora"
        subtitle="Tu espacio para proponer mejoras a McDental. Cada idea entra a la lista de pendientes de TI y puedes seguir aquí en qué va."
      />

      <Card className="empleado-form-card">
        <SectionTitle icon="lightbulb">Nueva idea</SectionTitle>

        <div className="mc-form-grid">
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="im-titulo">¿Qué propones?</label>
            <input
              id="im-titulo"
              className="mc-form-input"
              type="text"
              maxLength={200}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Que el recordatorio de cita salga también por WhatsApp"
            />
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="im-descripcion">Cuéntanos más</label>
            <textarea
              id="im-descripcion"
              className="mc-form-textarea"
              rows={5}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Qué problema resuelve, a quién le ayuda y cómo lo hacen hoy."
            />
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="im-prioridad">¿Qué tanto urge?</label>
            <Select
              id="im-prioridad"
              value={prioridad}
              onChange={(valor) => setPrioridad(valor)}
            >
              {PRIORIDADES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>
          <button type="button" className="mc-btn-primary mc-btn-with-icon" disabled={enviando} onClick={enviar}>
            <Icon name="lightbulb" size={16} /> {enviando ? "Enviando…" : "Enviar idea"}
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="history">Mis ideas</SectionTitle>

        {cargando ? (
          <div className="admin-empty">Consultando tus ideas…</div>
        ) : ideas.length === 0 ? (
          <EmptyState icon="lightbulb" message="Todavía no has propuesto ninguna idea." />
        ) : (
          <div className="empleado-solicitud-list">
            {ideas.map((i) => {
              const estado = ESTADOS[i.status] || { label: i.status, pill: "mc-status-pill--pendiente" };
              return (
                <div key={i.id} className="empleado-solicitud-item">
                  <div className="empleado-solicitud-main">
                    <div className="empleado-solicitud-title">#{i.id} · {i.title}</div>
                    <div className="empleado-solicitud-dates">
                      {"Prioridad "}{PRIORIDAD_LABEL[i.priority] || i.priority}
                      {" · Enviada el "}{formatoFecha(i.createdAt)}
                    </div>
                  </div>
                  <span className={`mc-status-pill ${estado.pill}`}>{estado.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default IdeasMejora;
