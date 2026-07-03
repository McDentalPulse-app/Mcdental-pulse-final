import { useEffect, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import { getCandidatosBolsa } from "../../services/supabase/bolsaTrabajoService";

const semaforoColor = { green: "#16a34a", yellow: "#d97706", red: "#dc2626" };
const estadoLabel = {
  pending_rh: "Pendiente RH",
  evaluation: "En evaluación",
  interview: "Entrevista",
  talent_pool: "Bolsa de talento",
  hired: "Contratado",
  rejected: "Rechazado",
};

// Sección de RH: candidatos que RH envía desde la app de reclutamiento
// McDental Talent. Se leen de la tabla candidatos_bolsa (solo lectura).
export default function BolsaTrabajo() {
  const [candidatos, setCandidatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const data = await getCandidatosBolsa();
        if (activo) setCandidatos(data);
      } catch (e) {
        if (activo) setError(e.message || "No se pudieron cargar los candidatos.");
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const pasos = [
    { icon: "search", label: "Filtro externo", desc: "Los candidatos aplican y pasan un primer filtro en la app de reclutamiento." },
    { icon: "inbox", label: "Llegan aquí", desc: "RH los envía desde la app de reclutamiento a esta bolsa." },
    { icon: "check", label: "Decides", desc: "RH revisa, agenda entrevistas y avanza a los mejores candidatos." },
  ];

  return (
    <div className="admin-page bolsa-page">
      <PageHeader
        icon="briefcase"
        eyebrow="RECURSOS HUMANOS"
        title="Bolsa de trabajo"
        subtitle="Candidatos filtrados que llegan desde la app de reclutamiento."
      />

      {loading && (
        <Card>
          <p style={{ padding: "1rem", textAlign: "center" }}>Cargando candidatos…</p>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <p style={{ padding: "1rem", textAlign: "center", color: "#dc2626" }}>
            {error}
          </p>
        </Card>
      )}

      {!loading && !error && candidatos.length === 0 && (
        <Card className="bolsa-empty">
          <div className="bolsa-empty-bg" aria-hidden="true" />
          <div className="bolsa-empty-icon">
            <Icon name="briefcase" size={30} />
          </div>
          <span className="bolsa-badge">En espera</span>
          <h2 className="bolsa-empty-title">Aún no hay candidatos</h2>
          <p className="bolsa-empty-text">
            Cuando RH envíe un candidato desde la app de reclutamiento, su perfil
            aparecerá automáticamente en esta bolsa para su revisión.
          </p>

          <div className="bolsa-steps">
            {pasos.map((p, i) => (
              <div key={p.label} className="bolsa-step">
                <span className="bolsa-step-num">{i + 1}</span>
                <span className="bolsa-step-icon"><Icon name={p.icon} size={18} /></span>
                <span className="bolsa-step-label">{p.label}</span>
                <span className="bolsa-step-desc">{p.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && !error && candidatos.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {candidatos.map((c) => (
            <Card key={c.id}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: semaforoColor[c.semaforo] || "#9ca3af",
                      flexShrink: 0,
                    }}
                  />
                  <strong style={{ flex: 1 }}>{c.nombre}</strong>
                  <span style={{ fontWeight: 700 }}>{c.score}</span>
                </div>
                <span style={{ opacity: 0.8, fontSize: "0.9rem" }}>{c.vacante}</span>
                <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>
                  {c.ciudad} · {estadoLabel[c.estado] || c.estado}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "0.85rem", opacity: 0.85 }}>
                  {c.telefono && <span>📞 {c.telefono}</span>}
                  {c.email && <span>✉️ {c.email}</span>}
                </div>
                {c.notas && (
                  <p style={{ fontSize: "0.85rem", opacity: 0.8, marginTop: "0.25rem" }}>
                    {c.notas}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
