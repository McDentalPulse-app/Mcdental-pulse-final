import { useState } from "react";
import Select from "../common/Select";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import StatCard from "../common/StatCard";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";
import { esEmpleadoActivo } from "../../utils/helpers";
import { CATEGORIAS_MEDALLA, getMedalla } from "../../config/medallas";
import Medalla from "../ui/Medalla";

const ReconocimientosGestion = ({ users, reconocimientos, onAdd, currentUser }) => {
  const { usuarios: USERS } = useGlobal();
  const { toast } = useNotification();

  const empleados = users.filter(esEmpleadoActivo);
  const [empleadoId, setEmpleadoId] = useState(empleados[0]?.id || "");
  const [categoria, setCategoria] = useState(CATEGORIAS_MEDALLA[0]);
  const [comentario, setComentario] = useState("");

  const otorgar = () => {
    const empleado = empleados.find(e => String(e.id) === String(empleadoId));
    if (!empleado) { toast.warning("Selecciona un empleado."); return; }
    if (!comentario.trim()) { toast.warning("Escribe un comentario para el reconocimiento."); return; }
    onAdd({
      empleadoId: empleado.id, empleado: empleado.name, sucursal: normalizeSucursal(empleado.sucursal),
      puesto: empleado.puesto, categoria, otorgadoPor: currentUser.name, comentario
    });
    setCategoria(CATEGORIAS_MEDALLA[0]);
    setComentario("");
    toast.success("Reconocimiento otorgado.");
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="award"
        title="Reconocimientos"
        subtitle="Otorga y consulta reconocimientos al personal por desempeño, actitud y valores McDental."
      />

      <div className="admin-stat-grid">
        <StatCard iconName="award" value={reconocimientos.length} label="Reconocimientos totales" valueClass="admin-stat-value--green" />
        <StatCard iconName="users" value={new Set(reconocimientos.map(r => r.empleadoId)).size} label="Empleados reconocidos" valueClass="admin-stat-value--blue" />
      </div>

      <div className="admin-grid-2">
        <Card>
          <SectionTitle icon="plus">Otorgar reconocimiento</SectionTitle>
          <div className="mc-form-grid">
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="rg-empleado">Empleado</label>
              <Select id="rg-empleado" value={empleadoId} onChange={(valor) => setEmpleadoId(valor)}>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>{e.name} · {normalizeSucursal(e.sucursal)} · {e.puesto}</option>
                ))}
              </Select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="rg-categoria">Categoría</label>
              <Select id="rg-categoria" value={categoria} onChange={(valor) => setCategoria(valor)}>
                {CATEGORIAS_MEDALLA.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="rg-comentario">Comentario</label>
              <textarea
                id="rg-comentario"
                className="mc-form-textarea"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Describe el motivo del reconocimiento..."
                rows={4}
              />
            </div>
            <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={otorgar}>
              <Icon name="award" size={16} /> Otorgar reconocimiento
            </button>
          </div>
        </Card>

        <Card>
          <SectionTitle icon="clipboard">Historial reciente</SectionTitle>
          <div className="admin-list-scroll admin-list-scroll--tall">
            {reconocimientos.slice().reverse().map(r => {
              const medalla = getMedalla(r.categoria);
              return (
              <div key={r.id} className="admin-list-item" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Medalla categoria={r.categoria} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="admin-list-item-title">{r.empleado}</div>
                  <div className="admin-list-item-meta" style={{ color: medalla.color, fontWeight: 700 }}>{r.categoria}</div>
                  <div className="admin-list-item-meta">{r.fecha} · {normalizeSucursal(r.sucursal)} · Otorgado por {r.otorgadoPor}</div>
                  <div className="admin-list-item-body">{r.comentario}</div>
                </div>
              </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReconocimientosGestion;
