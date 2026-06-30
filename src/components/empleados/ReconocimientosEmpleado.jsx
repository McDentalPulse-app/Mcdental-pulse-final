import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";

const ReconocimientosEmpleado = ({ user, reconocimientos }) => {
  const misReconocimientos = reconocimientos.filter(r => r.empleadoId === user.id);

  return (
    <div className="admin-page empleado-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Mis reconocimientos</h1>
        <p className="admin-page-subtitle">
          Historial de reconocimientos recibidos dentro de McDental.
        </p>
      </div>

      <div className="admin-stat-grid">
        <StatCard iconName="award" value={misReconocimientos.length} label="Reconocimientos recibidos" valueClass="admin-stat-value--green" />
      </div>

      {misReconocimientos.length === 0 ? (
        <Card className="empleado-empty-card">
          <div className="empleado-empty-icon">
            <Icon name="award" size={28} />
          </div>
          <h2 className="empleado-empty-title">Aún no tienes reconocimientos</h2>
          <p className="empleado-empty-text">
            Cuando recibas un reconocimiento por tu desempeño, aparecerá aquí.
          </p>
        </Card>
      ) : (
        <div className="empleado-award-grid">
          {misReconocimientos.map(r => (
            <Card key={r.id} className="empleado-award-card">
              <div className="empleado-award-icon">
                <Icon name="award" size={22} />
              </div>
              <div className="empleado-award-category">{r.categoria}</div>
              <div className="empleado-award-meta">
                {r.fecha} · Otorgado por {r.otorgadoPor}
              </div>
              <div className="empleado-award-comment">{r.comentario}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReconocimientosEmpleado;
