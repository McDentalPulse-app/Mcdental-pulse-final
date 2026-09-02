import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { rutaBaseDe } from "../../config/navItems";
import { useGlobal } from "../../contexts/GlobalContext";
import EncuestaDetalleModal from "./EncuestaDetalleModal";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import Card from "../common/Card";
import Badge from "../common/Badge";
import SectionTitle from "../common/SectionTitle";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { normalizeSucursal, formatSemanaDisplay } from "../../utils/constants";
import { calcPulseScore, calcRiesgos, getEmployeeAverageScore } from "../../utils/pulseScore";
import { nivelColor } from "../../config/theme";
import LineChart from "../common/LineChart";
import RiskBar from "../common/RiskBar";
import { formatAntiguedadEmpleado, formatEmpleadoIdForDisplay, formatFechaSolicitud } from "../../utils/helpers";
import Icon from "../ui/Icon";
import { ETIQUETA_CAUSA } from "../../utils/permisos";

/**
 * La ficha de un empleado, en panel lateral sobre lo que haya detrás.
 *
 * Vivía dentro de EmpleadosList. Se sacó aquí para poder abrirla TAMBIÉN desde los «Casos
 * prioritarios» del dashboard de psicología sin cambiar de pantalla: ahí el objetivo es
 * decidir a quién llamar hoy, y tener que ir a Empleados y buscar a la persona a mano es
 * justo la fricción que hace que no se mire.
 *
 * Portal a <body>: `.app-main` (o alguna de sus capas) crea un stacking context que atrapaba
 * al overlay `position: fixed` y lo dejaba por debajo de la barra de navegación, tapando el
 * botón de cerrar. Sacándolo del árbol del layout no depende de ningún z-index de la página.
 */
export default function FichaEmpleado({
  empleado,
  encuestas = [],
  notas = [],
  vacaciones = [],
  permisos = [],
  descuentos = [],
  reconocimientos = [],
  reportesConfidenciales = [],
  role,
  currentUser,
  onRestablecerPassword,
  onClose,
}) {
  // encuestaPreguntas hace falta para leer la respuesta de riesgo de renuncia: el jsonb
  // `respuestas` se indexa por el id de la pregunta, no por un número fijo.
  const { encuestaPreguntas } = useGlobal();

  const navigate = useNavigate();
  const [encuestaDetalle, setEncuestaDetalle] = useState(null);

  // El panel se cierra con Escape igual que el resto de los overlays de la app.
  useEscapeKey(onClose, true);

  // Escribirle: lleva a Mensajes con SU conversación ya abierta. No se escribe desde aquí a
  // propósito — el chat de verdad tiene historial, adjuntos y reacciones, y un segundo sitio
  // para mandar mensajes sería otro sitio que mantener y donde perder cosas.
  const escribirle = () => {
    onClose();
    navigate(`/${rutaBaseDe(currentUser?.role)}/mensajes`, { state: { conversarCon: empleado.id } });
  };

  const puedeRestablecer =
    (currentUser?.role === "admin" || currentUser?.role === "admin_plus") && typeof onRestablecerPassword === "function";

  // Solo la psicóloga. Para admin y RH, Mensajes NO es un chat general: es el buzón de Soporte
  // TI más su propia conversación con la psicóloga, así que ahí no existe un hilo con un
  // empleado que abrir. Ponerles el botón sería mandarlos a una pantalla donde el chat que se
  // abriría no es el de esa persona. Si algún día se quiere que admin o RH escriban al
  // personal, es una capacidad nueva y hay que decidirla, no colarla por este botón.
  const puedeEscribirle = currentUser?.role === "psicologa";

  // Sin ninguna encuesta contestada no es "verde" (estable) — es que no hay dato. Antes
  // caía a verde por defecto y se veía igual que alguien que de verdad está bien.
  const getUltimoSemaforo = (empId) => {
    const enc = encuestas
      .filter((e) => e.empleadoId === empId)
      .sort((a, b) => b.semana.localeCompare(a.semana));
    return enc[0]?.semaforo || "sin-datos";
  };

  if (!empleado) return null;

    const encEmp = encuestas
      .filter(e => e.empleadoId === empleado.id)
      .sort((a, b) => a.semana.localeCompare(b.semana));

    const notasEmp = notas.filter(n => n.empleadoId === empleado.id);
    // Historial de solicitudes: lo más reciente primero, por fecha de PETICIÓN. Ordenar
    // por la fecha del permiso mezclaría lo que se pidió ayer para dentro de un mes con
    // lo que se pidió hace un mes para mañana, y el expediente se lee al revés.
    const porSolicitudDesc = (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    const vacacionesEmp = vacaciones.filter(v => v.empleadoId === empleado.id).sort(porSolicitudDesc);
    const permisosEmp = permisos.filter(p => p.empleadoId === empleado.id).sort(porSolicitudDesc);
    const descuentosEmp = descuentos.filter(d => d.empleadoId === empleado.id);
    const reconocimientosEmp = reconocimientos.filter(r =>
  r.empleadoId === empleado.id ||
  r.empleado === empleado.name ||
  r.nombre === empleado.name
);
    const reportesEmp = reportesConfidenciales.filter(r => r.empleadoId === empleado.id);

    const sem = getUltimoSemaforo(empleado.id);
    const ps = calcPulseScore(empleado.id, encuestas);
    const promedioScore = getEmployeeAverageScore(empleado.id, encuestas);
    const trend = encEmp.map(e => ({
      label: formatSemanaDisplay(e.semana).replace("2026-", ""),
      v: e.score
    }));
    const riesgos = calcRiesgos(empleado.id, encuestas, encuestaPreguntas);

    // Portal a <body>: `.app-main` (o alguna de sus capas) crea un stacking context
    // que atrapaba al overlay `position: fixed` y lo dejaba por debajo de la barra
    // de navegación, tapando el botón de cerrar. Sacándolo del árbol del layout no
    // depende de ningún z-index de la página.

  return createPortal(
    <>
      <div className="mc-slideout-overlay" onClick={() => onClose()} role="presentation">
        <div
          className="mc-slideout-panel detail-page"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de ${empleado.name}`}
        >
          <button type="button" className="mc-slideout-close" onClick={() => onClose()} aria-label="Cerrar">
            <Icon name="xCircle" size={22} />
          </button>

          <div className="detail-grid-top">
          <Card className="detail-card-main">
            <div className="detail-emp-header">
              <Avatar name={empleado.name} size={64} color={nivelColor(sem)} photoUrl={empleado.avatarUrl} />

              <div className="detail-emp-header-texto">
                <div className="detail-emp-nombre">{empleado.name}</div>
                <div className="detail-emp-meta">{empleado.puesto} · {normalizeSucursal(empleado.sucursal)}</div>

                {role !== "rh" && (
                  <div className="detail-emp-badges">
                    <Badge tipo={sem} />
                    <PulseScoreBadge
                      score={ps.score}
                      nivel={ps.nivel}
                      slug={ps.slug}
                      tendencia={ps.tendencia}
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {puedeEscribirle && (
                <button
                  type="button"
                  className="mc-btn-outline mc-btn-with-icon detail-emp-header-accion"
                  onClick={escribirle}
                >
                  <Icon name="message" size={16} /> Enviar mensaje
                </button>
              )}

              {puedeRestablecer && (
                <button className="mc-btn-warning mc-btn-with-icon detail-emp-header-accion" onClick={() => onRestablecerPassword(empleado)}>
                  <Icon name="key" size={16} /> Restablecer contraseña
                </button>
              )}
            </div>

            <div className="detail-info-grid">
              <div className="detail-stat-box">
                <div className="detail-stat-label">Puesto</div>
                <div className="detail-stat-value detail-stat-value--sm" title={empleado.puesto}>{empleado.puesto}</div>
              </div>
              <div className="detail-stat-box">
                <div className="detail-stat-label">Sucursal</div>
                <div className="detail-stat-value detail-stat-value--sm" title={normalizeSucursal(empleado.sucursal)}>{normalizeSucursal(empleado.sucursal)}</div>
              </div>
              <div className="detail-stat-box">
                <div className="detail-stat-label">Antigüedad</div>
                <div className="detail-stat-value detail-stat-value--sm" title={formatAntiguedadEmpleado(empleado)}>{formatAntiguedadEmpleado(empleado)}</div>
              </div>
              <div className="detail-stat-box">
                <div className="detail-stat-label">ID empleado</div>
                <div className="detail-stat-value detail-stat-value--sm" title={formatEmpleadoIdForDisplay(empleado)}>{formatEmpleadoIdForDisplay(empleado)}</div>
              </div>
              <div className="detail-stat-box">
                <div className="detail-stat-label">Estado</div>
                <div className="detail-stat-value detail-stat-value--sm">Activo</div>
              </div>
            </div>

            {role !== "rh" && (
              <>
                <div className="detail-stats-grid">
                  <div className="detail-stat-box">
                    <div className="detail-stat-label">Promedio</div>
                    <div className="detail-stat-value">
                      {promedioScore ?? "—"}
                    </div>
                  </div>

                  <div className="detail-stat-box">
                    <div className="detail-stat-label">Encuestas</div>
                    <div className="detail-stat-value">
                      {encEmp.length}
                    </div>
                  </div>

                  <div className="detail-stat-box">
                    <div className="detail-stat-label">Notas</div>
                    <div className="detail-stat-value">
                      {notasEmp.length}
                    </div>
                  </div>
                </div>

                <SectionTitle icon="trending">Evolución Pulse</SectionTitle>

                {trend.length > 1 ? (
                  <LineChart data={trend} slug={ps.slug} />
                ) : (
                  <div className="detail-vacio">
                    Sin suficientes datos para graficar.
                  </div>
                )}
              </>
            )}
          </Card>

          {role !== "rh" && (
            <Card className="detail-card-side">
              <SectionTitle icon="shield">Riesgos IA</SectionTitle>

              {riesgos.sinDatos ? (
                <p className="admin-empty" style={{ margin: 0, fontSize: 13 }}>
                  Sin datos suficientes para estimar riesgos.
                </p>
              ) : (
                <>
                  <RiskBar
                    label="Riesgo Renuncia"
                    value={riesgos.renuncia}
                    slug={riesgos.renuncia > 60 ? "rojo" : riesgos.renuncia > 30 ? "amarillo" : "verde"}
                  />

                  <RiskBar
                    label="Riesgo Burnout"
                    value={riesgos.burnout}
                    slug={riesgos.burnout > 60 ? "rojo" : riesgos.burnout > 30 ? "amarillo" : "verde"}
                  />

                  <RiskBar
                    label="Riesgo Emocional"
                    value={riesgos.emocional}
                    slug={riesgos.emocional > 60 ? "rojo" : riesgos.emocional > 30 ? "amarillo" : "verde"}
                  />
                </>
              )}
            </Card>
          )}
        </div>

        <div className="detail-grid-2">
          {role !== "rh" && (
            <Card>
              <SectionTitle icon="clipboard">Historial de encuestas</SectionTitle>
              <div className="detail-list-scroll">
              {encEmp.length === 0 ? (
                <div className="detail-vacio">Sin encuestas registradas</div>
              ) : (
                // Clicables, igual que en Expedientes: ver el score sin poder ver QUÉ
                // contestó obliga a salir de aquí e ir a buscar la misma encuesta a otra
                // pantalla, que es justo lo que hace que no se mire.
                encEmp.map(e => (
                  <button
                    type="button"
                    key={e.id}
                    className="detail-list-item detail-list-item--accion"
                    onClick={() => setEncuestaDetalle(e)}
                    title="Ver las respuestas de esta encuesta"
                  >
                    <span>{formatSemanaDisplay(e.semana)}</span>
                    <Badge tipo={e.semaforo} />
                    <span style={{ fontWeight: 800 }}>{e.score}</span>
                    <Icon name="eye" size={15} className="detail-list-item-ojo" />
                  </button>
                ))
              )}
              </div>
            </Card>
          )}

          {role === "psicologa" && (
            <Card>
              <SectionTitle icon="heart">Notas psicológicas</SectionTitle>
              <div className="detail-list-scroll">
              {notasEmp.length === 0 ? (
                <div className="detail-vacio">Sin notas registradas</div>
              ) : (
                notasEmp.map(n => (
                  <div key={n.id} className="detail-list-item-block">
                    <div style={{ color: "var(--mc-texto-titulo)" }}>{n.texto}</div>
                    <div style={{ color: "var(--mc-texto-secundario)", fontSize: 11 }}>{n.fecha}</div>
                  </div>
                ))
              )}
              </div>
            </Card>
          )}
        </div>

        <div className="detail-grid-2">
          <Card>
            <SectionTitle icon="vacation">Vacaciones</SectionTitle>
            <div className="detail-list-scroll">
            {vacacionesEmp.length === 0 ? (
              <div className="detail-vacio">Sin vacaciones registradas</div>
            ) : (
              vacacionesEmp.map(v => (
                <div key={v.id} className="detail-list-item-block">
                  <strong>{v.estado}</strong> · {v.fechaInicio || v.inicio || v.desde} al {v.fechaFin || v.fin || v.hasta}
                  <br />
                  <span style={{ color: "var(--mc-texto-secundario)" }}>
                    {v.dias} días · {v.motivo}
                  </span>
                  {v.createdAt && (
                    <>
                      <br />
                      <span className="detail-solicitud-fecha">
                        Solicitado el {formatFechaSolicitud(v.createdAt)}
                      </span>
                    </>
                  )}
                  {v.comentarioRH && (
                    <>
                      <br />
                      <span style={{ color: "var(--mc-texto-secundario)" }}>
                        Comentario RH: {v.comentarioRH}
                      </span>
                    </>
                  )}
                </div>
              ))
            )}
            </div>
          </Card>

          {/* Permisos: faltaba en el expediente — solo estaban las vacaciones, así que
              gestión no tenía dónde consultar el historial de permisos de una persona
              sin irse a la pantalla de Permisos y filtrar. */}
          <Card>
            <SectionTitle icon="clipboardCheck">Permisos</SectionTitle>
            <div className="detail-list-scroll">
            {permisosEmp.length === 0 ? (
              <div className="detail-vacio">Sin permisos registrados</div>
            ) : (
              permisosEmp.map(p => (
                <div key={p.id} className="detail-list-item-block">
                  <strong>{p.estado}</strong> · {p.fecha}
                  {p.fechaFin && p.fechaFin !== p.fecha ? ` al ${p.fechaFin}` : ""}
                  {p.hora ? ` · ${p.hora}` : ""}
                  <br />
                  <span style={{ color: "var(--mc-texto-secundario)" }}>
                    {/* ETIQUETA_CAUSA y no p.causa a secas: en la base la causa se guarda
                        acotada al catálogo ('tramite_oficial'), y eso es lo que se leería
                        en pantalla si no se traduce. */}
                    {[ETIQUETA_CAUSA[p.causa] || p.causa, p.motivo].filter(Boolean).join(" · ") || "Sin motivo"}
                  </span>
                  {p.createdAt && (
                    <>
                      <br />
                      <span className="detail-solicitud-fecha">
                        Solicitado el {formatFechaSolicitud(p.createdAt)}
                      </span>
                    </>
                  )}
                  {p.comentarioRH && (
                    <>
                      <br />
                      <span style={{ color: "var(--mc-texto-secundario)" }}>
                        Comentario RH: {p.comentarioRH}
                      </span>
                    </>
                  )}
                </div>
              ))
            )}
            </div>
          </Card>

          {role !== "psicologa" && (
            <Card>
              <SectionTitle icon="dollar">Descuentos</SectionTitle>
              <div className="detail-list-scroll">
              {descuentosEmp.length === 0 ? (
                <div className="detail-vacio">Sin descuentos</div>
              ) : (
                descuentosEmp.map(d => (
                  <div key={d.id} className="detail-list-item-block">
                    <strong>{d.estado}</strong> · {d.concepto || d.motivo}
                    <br />
                    <span style={{ color: "var(--mc-texto-secundario)" }}>
                      {d.monto ? `$${d.monto}` : ""}
                    </span>
                  </div>
                ))
              )}
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle icon="award">Reconocimientos</SectionTitle>
            <div className="detail-list-scroll">
            {reconocimientosEmp.length === 0 ? (
              <div className="detail-vacio">Sin reconocimientos</div>
            ) : (
              reconocimientosEmp.map(r => (
                <div key={r.id} className="detail-list-item-block">
                  <strong>{r.titulo || r.tipo || r.categoria}</strong>
<br />
<span style={{ color: "var(--mc-texto-secundario)" }}>
  {r.descripcion || r.motivo || r.comentario}
</span>
{r.otorgadoPor && (
  <>
    <br />
    <span style={{ color: "var(--mc-texto-secundario)", fontSize: 12 }}>
      Otorgado por: {r.otorgadoPor}
    </span>
  </>
)}
{r.fecha && (
  <>
    <br />
    <span style={{ color: "var(--mc-texto-secundario)", fontSize: 12 }}>
      Fecha: {r.fecha}
    </span>
  </>
)}
                </div>
              ))
            )}
            </div>
          </Card>

          {role !== "rh" && (
            <Card>
              <SectionTitle icon="lock">Reportes confidenciales</SectionTitle>
              <div className="detail-list-scroll">
              {reportesEmp.length === 0 ? (
                <div className="detail-vacio">Sin reportes confidenciales</div>
              ) : (
                reportesEmp.map(r => (
                  <div key={r.id} className="detail-list-item-block">
                    <strong>{r.fecha || "Reporte"}</strong>
                    <br />
                    <span style={{ color: "var(--mc-texto-secundario)" }}>
                      {r.resumen || r.texto || r.motivo || r.descripcion}
                    </span>
                  </div>
                ))
              )}
              </div>
            </Card>
          )}
        </div>
        </div>
      </div>

      {/* HERMANO del panel, no hijo. La regla de capas de DESIGN.md: el detalle de encuesta
          vive en z-index 10000 y el panel en 9999, así que puesto aquí queda por encima.
          Dentro del panel lo recortaría el primer ancestro con overflow: hidden. */}
      {encuestaDetalle && (
        <EncuestaDetalleModal
          encuesta={encuestaDetalle}
          empleado={empleado}
          preguntas={encuestaPreguntas}
          onClose={() => setEncuestaDetalle(null)}
        />
      )}
    </>,
    document.body
  );
}
