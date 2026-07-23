import { useState, lazy, Suspense } from "react";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import HtmlSeguro from "../common/HtmlSeguro";
import { useNotification } from "../../contexts/NotificationContext";
import { SUCURSALES } from "../../utils/constants";

// El editor enriquecido (TipTap) se carga solo al abrir el panel de avisos (gestión), no en el
// bundle de empleados/doctores que solo LEEN los avisos.
const EditorTexto = lazy(() => import("../common/EditorTexto"));

const ROLES_GESTION = ["admin", "rh", "psicologa"];

const formatoFecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

/**
 * Historial de avisos: lo ve cualquier rol, pero solo admin/rh/psicologa tienen el
 * formulario de arriba y los botones de Editar/Eliminar — RLS lo respalda del lado del
 * servidor (migración 058), esto solo evita ofrecerle a un empleado un botón que de
 * todos modos le rechazaría la base.
 */
const AvisosPanel = ({ user, avisos = [], onAdd, onUpdate, onDelete }) => {
  const { toast, confirm } = useNotification();
  const puedeGestionar = ROLES_GESTION.includes(user?.role);

  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [sucursalesSel, setSucursalesSel] = useState([]);
  const [buscarSuc, setBuscarSuc] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const toggleSucursal = (s) =>
    setSucursalesSel((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const sucursalesFiltradas = SUCURSALES.filter((s) =>
    s.toLowerCase().includes(buscarSuc.trim().toLowerCase())
  );

  const limpiarFormulario = () => {
    setTitulo("");
    setCuerpo("");
    setSucursalesSel([]);
    setBuscarSuc("");
    setEditandoId(null);
  };

  const iniciarEdicion = (aviso) => {
    setTitulo(aviso.titulo);
    setCuerpo(aviso.cuerpo);
    setSucursalesSel(aviso.sucursales || []);
    setEditandoId(aviso.id);
  };

  const enviar = async () => {
    if (!titulo.trim() || !cuerpo.trim()) {
      toast.warning("Completa el título y el cuerpo del aviso.");
      return;
    }
    if (sucursalesSel.length === 0) {
      toast.warning("No seleccionaste ninguna sucursal, elige al menos una para poder enviar el aviso.");
      return;
    }

    setEnviando(true);
    const ok = editandoId
      ? await onUpdate(editandoId, { titulo: titulo.trim(), cuerpo: cuerpo.trim(), sucursales: sucursalesSel })
      : await onAdd({ titulo: titulo.trim(), cuerpo: cuerpo.trim(), sucursales: sucursalesSel });
    setEnviando(false);

    if (ok) {
      toast.success(editandoId ? "Aviso actualizado." : "Aviso publicado.");
      limpiarFormulario();
    }
  };

  const eliminar = async (aviso) => {
    const ok = await confirm({
      title: "Eliminar aviso",
      description: `¿Seguro que quieres eliminar "${aviso.titulo}"? Ya no se le mostrará a nadie.`,
      variant: "danger",
      confirmText: "Eliminar",
    });
    if (!ok) return;

    const eliminado = await onDelete(aviso.id);
    if (eliminado && editandoId === aviso.id) limpiarFormulario();
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="bell"
        title="Avisos"
        subtitle="Comunicados de la clínica. Todos los ven al entrar; solo RH, psicología y admin los publican."
      />

      {puedeGestionar && (
        <Card className="empleado-form-card">
          <SectionTitle icon="bell">{editandoId ? "Editar aviso" : "Nuevo aviso"}</SectionTitle>

          <div className="mc-form-grid">
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="aviso-titulo">Título</label>
              <input
                id="aviso-titulo"
                className="mc-form-input"
                type="text"
                maxLength={150}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Cambio de horario por puente"
              />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Cuerpo</label>
              <Suspense fallback={<div className="editor-cargando">Cargando editor…</div>}>
                <EditorTexto value={cuerpo} onChange={setCuerpo} placeholder="Escribe el comunicado completo." />
              </Suspense>
            </div>

            <div className="mc-form-group">
              <label className="mc-form-label">Sucursales destino</label>
              <div className="aviso-suc-toolbar">
                <input
                  className="mc-form-input aviso-suc-buscar"
                  type="text"
                  placeholder="Buscar sucursal…"
                  value={buscarSuc}
                  onChange={(e) => setBuscarSuc(e.target.value)}
                />
                <button type="button" className="mc-btn-outline" onClick={() => setSucursalesSel(SUCURSALES)}>
                  Seleccionar todas
                </button>
                <button type="button" className="mc-btn-outline" onClick={() => setSucursalesSel([])}>
                  Limpiar
                </button>
                <span className="aviso-suc-contador">{sucursalesSel.length} de {SUCURSALES.length}</span>
              </div>
              <div className="aviso-suc-chips">
                {sucursalesFiltradas.map((s) => {
                  const activa = sucursalesSel.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`aviso-suc-chip${activa ? " aviso-suc-chip--activa" : ""}`}
                      aria-pressed={activa}
                      onClick={() => toggleSucursal(s)}
                    >
                      {s}
                    </button>
                  );
                })}
                {sucursalesFiltradas.length === 0 && <span className="mc-empty">Sin coincidencias.</span>}
              </div>
            </div>

            <div className="mc-form-row-2">
              <button type="button" className="mc-btn-primary mc-btn-with-icon" disabled={enviando} onClick={enviar}>
                <Icon name={editandoId ? "check" : "bell"} size={16} />
                {enviando ? "Guardando…" : editandoId ? "Guardar cambios" : "Publicar aviso"}
              </button>
              {editandoId && (
                <button type="button" className="mc-btn-outline" disabled={enviando} onClick={limpiarFormulario}>
                  Cancelar edición
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      <SectionTitle icon="history">Historial</SectionTitle>

      {avisos.length === 0 ? (
        <Card><p className="mc-empty">Todavía no se ha publicado ningún aviso.</p></Card>
      ) : (
        <div className="rh-data-list">
          {avisos.map((a) => (
            <div key={a.id} className="rh-data-row">
              <div className="rh-data-row-main">
                <div className="rh-data-row-title">{a.titulo}</div>
                <HtmlSeguro className="rh-data-row-detail aviso-row-cuerpo" html={a.cuerpo} />
                {a.sucursales?.length > 0 && (
                  <div className="aviso-row-sucursales">
                    {a.sucursales.length === SUCURSALES.length ? (
                      <span className="aviso-suc-badge aviso-suc-badge--todas">Todas las sucursales</span>
                    ) : (
                      a.sucursales.map((s) => <span key={s} className="aviso-suc-badge">{s}</span>)
                    )}
                  </div>
                )}
              </div>
              <div className="rh-data-row-meta">
                <div className="rh-data-row-meta-primary">{a.autor || "—"}</div>
                <div className="rh-data-row-meta-secondary">{formatoFecha(a.createdAt)}</div>
              </div>
              {puedeGestionar && (
                <div className="rh-data-row-actions">
                  <button type="button" className="mc-btn-outline" onClick={() => iniciarEdicion(a)}>
                    <Icon name="clipboardCheck" size={15} /> Editar
                  </button>
                  <button type="button" className="mc-btn-outline mc-btn-outline--danger" onClick={() => eliminar(a)}>
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvisosPanel;
