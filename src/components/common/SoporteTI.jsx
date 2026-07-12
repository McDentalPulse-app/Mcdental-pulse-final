import React, { useState } from "react";
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

// Abre un ticket de soporte en el sistema de TI (MCTIC) a través del proxy serverless.
const SoporteTI = ({ user }) => {
  const { toast } = useNotification();
  const [categoria, setCategoria] = useState("HARDWARE");
  const [prioridad, setPrioridad] = useState("MEDIA");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [folio, setFolio] = useState(null);

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
      setFolio(data.id);
      setAsunto("");
      setDescripcion("");
      toast.success(`Ticket de soporte enviado (folio #${data.id}).`);
    } catch (err) {
      toast.error(err.message || "No se pudo enviar el ticket.");
    } finally {
      setEnviando(false);
    }
  };

  if (folio) {
    return (
      <div className="admin-page empleado-page empleado-form-narrow">
        <Card className="empleado-success-card">
          <SectionTitle icon="check">¡Ticket enviado!</SectionTitle>
          <p className="admin-page-subtitle">
            Tu solicitud llegó a Soporte TI con el folio <strong>#{folio}</strong>.
            El área de TI la atenderá y te dará seguimiento.
          </p>
          <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={() => setFolio(null)}>
            <Icon name="plus" size={16} /> Abrir otro ticket
          </button>
        </Card>
      </div>
    );
  }

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
    </div>
  );
};

export default SoporteTI;
