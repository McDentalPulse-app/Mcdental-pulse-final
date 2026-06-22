import React from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";

const ReconocimientosEmpleado = ({ user, reconocimientos }) => {
  const { usuarios: USERS } = useGlobal();

  const misReconocimientos = reconocimientos.filter(r => r.empleadoId === user.id);

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Mis Reconocimientos
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Historial de reconocimientos recibidos dentro de McDental.
      </p>

      <div className="admin-stat-grid">
        <StatCard iconName="award" value={misReconocimientos.length} label="Reconocimientos recibidos" valueClass="admin-stat-value--green" />
      </div>

      <Card>
        <SectionTitle icon="award">Historial</SectionTitle>

        {misReconocimientos.length === 0 ? (
          <p style={{ color: "#64748b" }}>Aún no tienes reconocimientos registrados.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {misReconocimientos.map(r => (
              <div
                key={r.id}
                style={{
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  background: "#f8fafc"
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 900, color: "#004D40", display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="award" size={18} /> {r.categoria}
                </div>
                <div style={{ color: "#64748b", fontSize: 13, margin: "4px 0 10px" }}>
                  {r.fecha} · Otorgado por {r.otorgadoPor}
                </div>
                <div style={{ color: "#334155", lineHeight: 1.6 }}>
                  {r.comentario}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};


export default ReconocimientosEmpleado;
