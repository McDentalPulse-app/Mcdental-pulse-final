import { useCallback, useEffect, useState } from "react";
import Card from "./Card";
import PageHeader from "./PageHeader";
import SectionTitle from "./SectionTitle";
import Icon from "../ui/Icon";
import { supabase } from "../../config/supabase";
import { useNotification } from "../../contexts/NotificationContext";

const CATEGORIAS = [
  { value: "HARDWARE", label: "Equipo / Hardware (computadora, impresora…)" },
  { value: "SOFTWARE", label: "Programas / Sistema" },
  { value: "RED", label: "Red / Internet" },
  { value: "CUENTAS", label: "Cuentas y accesos" },
  { value: "OTRO", label: "Otro" },
];

const PRIORIDADES = [
  { value: "BAJA", label: "Baja" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta" },
  { value: "CRITICA", label: "Crítica (no puedo trabajar)" },
];

// Los estados vienen de MCTIC (ABIERTO / EN_PROGRESO / RESUELTO / CERRADO). Se traducen a
// texto legible y se reusan las variantes de pill que ya existen en el sistema de diseño.
const ESTADOS = {
  ABIERTO: { label: "Abierto", pill: "mc-status-pill--nuevo" },
  EN_PROGRESO: { label: "En progreso", pill: "mc-status-pill--seguimiento" },
  RESUELTO: { label: "Resuelto", pill: "mc-status-pill--aprobado" },
  CERRADO: { label: "Cerrado", pill: "mc-status-pill--cerrado" },
};

const PRIORIDAD_LABEL = { BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", CRITICA: "Crítica" };
const CATEGORIA_LABEL = {
  HARDWARE: "Equipo",
  SOFTWARE: "Programas",
  RED: "Red",
  CUENTAS: "Cuentas y accesos",
  OTRO: "Otro",
};

const formatoFecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

// Abre tickets de soporte en el sistema de TI (MCTIC) y muestra el estado de los propios,
// todo a través del proxy serverless (la clave de integración nunca llega al navegador).
const SoporteTI = ({ user }) => {
  const { toast } = useNotification();
  const [categoria, setCategoria] = useState("HARDWARE");
  const [prioridad, setPrioridad] = useState("MEDIA");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargarTickets = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch("/api/soporte-ticket", {
      headers: { Authorization: `Bearer ${session?.access_token || ""}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || "No se pudieron consultar tus tickets.");
    return data.tickets || [];
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const lista = await cargarTickets();
        if (activo) setTickets(lista);
      } catch (err) {
        if (activo) toast.error(err.message || "No se pudieron consultar tus tickets.");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, [cargarTickets, toast]);

  const enviar = async () => {
    if (!asunto.trim()) {
      toast.warning("Describe brevemente el problema en el asunto.");
      return;
    }
    setEnviando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/soporte-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          subject: asunto.trim(),
          description: descripcion.trim(),
          category: categoria,
          priority: prioridad,
          name: user?.name,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || "No se pudo enviar el ticket.");
      }
      setAsunto("");
      setDescripcion("");
      toast.success(`Ticket de soporte enviado (folio #${data.id}).`);
      // Si la relectura fallara, el ticket ya quedó creado: la lista se pondrá al día al recargar.
      const lista = await cargarTickets().catch(() => null);
      if (lista) setTickets(lista);
    } catch (err) {
      toast.error(err.message || "No se pudo enviar el ticket.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="admin-page empleado-page empleado-form-narrow">
      <PageHeader
        icon="wrench"
        title="Soporte TI"
        subtitle="¿Un problema con tu equipo, un programa o tus accesos? Abre un ticket y el área de TI lo atenderá."
      />

      <Card className="empleado-form-card">
        <SectionTitle icon="wrench">Nuevo ticket</SectionTitle>

        <div className="mc-form-grid">
          <div className="mc-form-row-2">
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="st-categoria">Categoría</label>
              <select
                id="st-categoria"
                className="mc-form-select"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="st-prioridad">Prioridad</label>
              <select
                id="st-prioridad"
                className="mc-form-select"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="st-asunto">Asunto</label>
            <input
              id="st-asunto"
              className="mc-form-input"
              type="text"
              maxLength={200}
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Ej. No enciende mi computadora"
            />
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="st-descripcion">Descripción</label>
            <textarea
              id="st-descripcion"
              className="mc-form-textarea"
              rows={5}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Cuéntanos qué pasa, desde cuándo y qué has intentado."
            />
          </div>
          <button type="button" className="mc-btn-primary mc-btn-with-icon" disabled={enviando} onClick={enviar}>
            <Icon name="wrench" size={16} /> {enviando ? "Enviando…" : "Enviar ticket"}
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="history">Mis tickets</SectionTitle>

        {cargando ? (
          <div className="admin-empty">Consultando tus tickets…</div>
        ) : tickets.length === 0 ? (
          <div className="admin-empty">Todavía no has abierto ningún ticket de soporte.</div>
        ) : (
          <div className="empleado-solicitud-list">
            {tickets.map((t) => {
              const estado = ESTADOS[t.status] || { label: t.status, pill: "mc-status-pill--pendiente" };
              return (
                <div key={t.id} className="empleado-solicitud-item">
                  <div className="empleado-solicitud-main">
                    <div className="empleado-solicitud-title">#{t.id} · {t.subject}</div>
                    <div className="empleado-solicitud-dates">
                      {CATEGORIA_LABEL[t.category] || t.category}
                      {" · Prioridad "}{PRIORIDAD_LABEL[t.priority] || t.priority}
                      {" · Abierto el "}{formatoFecha(t.createdAt)}
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

export default SoporteTI;
