import { useMemo } from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import ComisionGrupo from "./ComisionGrupo";
import ComisionItem from "./ComisionItem";
import { normalizeSucursal } from "../../utils/constants";
import { useNotification } from "../../contexts/NotificationContext";

const ComisionesRH = ({ comisiones, onRevisar }) => {
  const { prompt } = useNotification();

  const pendientes = comisiones.filter((c) => c.estado === "pendiente").length;
  const validas = comisiones.filter((c) => c.estado === "valida").length;
  const invalidas = comisiones.filter((c) => c.estado === "invalida").length;

  // Agrupar por doctor: cada doctor es una sección colapsable. Los doctores con pendientes van
  // primero (y sus secciones abiertas); dentro, los recibos pendientes primero.
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const c of comisiones) {
      if (!mapa.has(c.doctorId)) {
        mapa.set(c.doctorId, { doctorId: c.doctorId, doctor: c.doctor, sucursal: c.sucursal, items: [] });
      }
      mapa.get(c.doctorId).items.push(c);
    }
    const lista = [...mapa.values()].map((g) => ({
      ...g,
      pendientes: g.items.filter((c) => c.estado === "pendiente").length,
      items: [...g.items].sort((a, b) => (b.estado === "pendiente") - (a.estado === "pendiente")),
    }));
    // Doctores con pendientes primero; luego por nombre.
    lista.sort((a, b) => (b.pendientes > 0) - (a.pendientes > 0) || (a.doctor || "").localeCompare(b.doctor || ""));
    return lista;
  }, [comisiones]);

  const handleRevisar = async (id, estado) => {
    const comentario = await prompt({
      title: estado === "valida" ? "Validar recibo" : "Rechazar recibo",
      description: "Comentario para el doctor (opcional):",
      placeholder: "Escribe un comentario (opcional)",
      confirmText: estado === "valida" ? "Validar" : "Rechazar",
    });
    if (comentario === null) return; // canceló
    onRevisar(id, estado, comentario || "");
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="dollar"
        title="Comisiones"
        subtitle="Revisa los recibos por doctor. Despliega un doctor y luego un recibo para ver la foto y validarlo o rechazarlo."
      />

      <div className="admin-stat-grid">
        <StatCard iconName="clock" value={pendientes} label="Pendientes" valueClass="admin-stat-value--amber" />
        <StatCard iconName="check" value={validas} label="Validadas" valueClass="admin-stat-value--green" />
        <StatCard iconName="xCircle" value={invalidas} label="Rechazadas" valueClass="admin-stat-value--red" />
      </div>

      <Card>
        <SectionTitle icon="dollar">Recibos por doctor</SectionTitle>
        {grupos.length === 0 ? (
          <p className="rh-data-row-muted">Todavía no hay recibos.</p>
        ) : (
          <div className="comision-lista">
            {grupos.map((g) => (
              <ComisionGrupo
                key={g.doctorId}
                titulo={g.doctor}
                subtitulo={normalizeSucursal(g.sucursal)}
                conteo={g.items.length}
                pendientes={g.pendientes}
                defaultAbierto={g.pendientes > 0}
              >
                {g.items.map((c) => (
                  <ComisionItem key={c.id} comision={c}>
                    {c.estado === "pendiente" && (
                      <div className="comision-item-actions">
                        <button type="button" className="mc-btn-primary mc-btn-sm-action" onClick={() => handleRevisar(c.id, "valida")}>
                          <Icon name="check" size={14} /> Válida
                        </button>
                        <button type="button" className="mc-btn-danger mc-btn-sm-action" onClick={() => handleRevisar(c.id, "invalida")}>
                          <Icon name="xCircle" size={14} /> Inválida
                        </button>
                      </div>
                    )}
                  </ComisionItem>
                ))}
              </ComisionGrupo>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ComisionesRH;
