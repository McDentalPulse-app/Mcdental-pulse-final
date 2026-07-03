import React from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import Icon from "../ui/Icon";

// Sección de RH donde llegarán los candidatos que pasen el filtro de la app de
// reclutamiento (todavía en construcción). Por ahora es un estado "en desarrollo"
// premium — sin datos aún, pero deja claro qué va a vivir aquí.
export default function BolsaTrabajo() {
  const pasos = [
    { icon: "search", label: "Filtro externo", desc: "Los candidatos aplican y pasan un primer filtro en la app de reclutamiento." },
    { icon: "inbox", label: "Llegan aquí", desc: "Los perfiles aprobados se envían automáticamente a esta bolsa." },
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

      <Card className="bolsa-empty">
        <div className="bolsa-empty-bg" aria-hidden="true" />
        <div className="bolsa-empty-icon">
          <Icon name="briefcase" size={30} />
        </div>
        <span className="bolsa-badge">En desarrollo</span>
        <h2 className="bolsa-empty-title">Muy pronto: candidatos aquí</h2>
        <p className="bolsa-empty-text">
          Esta sección se conectará con la app de reclutamiento. Cuando un candidato
          pase el primer filtro, su perfil aparecerá automáticamente en esta bolsa
          para que RH lo revise. Aún no hay candidatos por mostrar.
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
    </div>
  );
}
