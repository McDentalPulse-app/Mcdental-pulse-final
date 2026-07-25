import React, { useMemo, useState } from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import CapturaRecibo from "./CapturaRecibo";
import ComisionGrupo from "./ComisionGrupo";
import ComisionItem from "./ComisionItem";

// La fecha de hoy que el doctor debe escribir a mano en el recibo. Se muestra tal cual para que
// no haya duda de qué fecha anotar.
const hoyLegible = () =>
  new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Los recibos del doctor se separan por estado, con lo pendiente abierto por defecto.
const GRUPOS = [
  { estado: "pendiente", titulo: "Pendientes", abierto: true },
  { estado: "valida", titulo: "Validadas", abierto: false },
  { estado: "invalida", titulo: "Rechazadas", abierto: false },
];

const ComisionesDoctor = ({ user, comisiones, onCrear }) => {
  const [archivo, setArchivo] = useState(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [camaraKey, setCamaraKey] = useState(0); // remonta la cámara para volver a tomar otra

  const mias = useMemo(
    () => comisiones.filter((c) => c.doctorId === user.id),
    [comisiones, user.id],
  );
  const pendientes = mias.filter((c) => c.estado === "pendiente").length;
  const validas = mias.filter((c) => c.estado === "valida").length;

  const enviar = async () => {
    if (!archivo || enviando) return;
    setEnviando(true);
    const ok = await onCrear({ archivo, nota });
    setEnviando(false);
    if (ok) {
      setArchivo(null);
      setNota("");
      setCamaraKey((k) => k + 1); // reinicia la cámara para el siguiente recibo
    }
  };

  return (
    <div className="admin-page empleado-page">
      <PageHeader
        icon="dollar"
        title="Comisiones"
        subtitle="Sube la foto del recibo con la fecha de hoy escrita a mano. RH lo revisará y te avisará."
      />

      <div className="admin-stat-grid">
        <StatCard iconName="clock" value={pendientes} label="Pendientes de revisar" valueClass="admin-stat-value--amber" />
        <StatCard iconName="check" value={validas} label="Validadas" valueClass="admin-stat-value--green" />
      </div>

      <Card>
        <SectionTitle icon="camera">Subir un recibo</SectionTitle>
        <p className="comision-fecha-hint">
          <Icon name="calendar" size={15} /> Anota <strong>hoy</strong> en el recibo: {hoyLegible()}
        </p>

        <CapturaRecibo key={camaraKey} onFoto={setArchivo} />

        <textarea
          className="mc-form-textarea"
          placeholder="Nota opcional (concepto, referencia…)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
        />

        <button
          type="button"
          className="mc-btn-primary"
          onClick={enviar}
          disabled={!archivo || enviando}
        >
          <Icon name="check" size={15} /> {enviando ? "Enviando…" : "Enviar recibo"}
        </button>
      </Card>

      <Card>
        <SectionTitle icon="dollar">Mis recibos</SectionTitle>
        {mias.length === 0 ? (
          <p className="rh-data-row-muted">Aún no has subido ningún recibo.</p>
        ) : (
          <div className="comision-lista">
            {GRUPOS.map((g) => {
              const items = mias.filter((c) => c.estado === g.estado);
              if (!items.length) return null;
              return (
                <ComisionGrupo key={g.estado} titulo={g.titulo} conteo={items.length} defaultAbierto={g.abierto}>
                  {items.map((c) => <ComisionItem key={c.id} comision={c} />)}
                </ComisionGrupo>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ComisionesDoctor;
