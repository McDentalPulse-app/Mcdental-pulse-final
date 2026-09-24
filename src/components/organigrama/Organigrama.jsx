import { useMemo, useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import Icon from "../ui/Icon";
import ResponsabilidadesArea from "./ResponsabilidadesArea";
import organigramaImg from "../../assets/organigrama/organigrama-mcdental.png";
import "./Organigrama.css";

const PUEDE_EDITAR = ["admin", "admin_plus", "rh"];

/**
 * Organigrama: pedido del dueño, 2026-09-24, dejó de construirse de los datos de `usuarios`
 * (jefe/área) para mostrar la imagen fija que mandó — la estructura real de la empresa no
 * coincidía con jefe/área capturados en el sistema, y ese cálculo ya no vale la pena mantener.
 * "Responsabilidades por depto." es una pantalla aparte (documentos por área, no la jerarquía)
 * y no se tocó.
 */
export default function Organigrama({ user }) {
  const { areas, refreshAreas } = useGlobal();
  const [mostrarDocs, setMostrarDocs] = useState(false);

  const puedeEditar = PUEDE_EDITAR.includes(user?.role);
  const areasOrdenadas = useMemo(() => [...areas].sort((a, b) => a.orden - b.orden), [areas]);

  return (
    <div className="admin-page organigrama-page">
      <PageHeader
        icon="users"
        eyebrow="McDental Pulse"
        title="Organigrama"
        subtitle="Quién reporta a quién, y las responsabilidades de cada departamento."
      >
        <button
          type="button"
          className="mc-btn-secondary"
          onClick={() => setMostrarDocs((v) => !v)}
        >
          <Icon name="fileDownload" size={16} />
          {mostrarDocs ? "Ver organigrama" : "Responsabilidades por depto."}
        </button>
      </PageHeader>

      {mostrarDocs ? (
        <div className="organigrama-areas-grid">
          {areasOrdenadas.length === 0 ? (
            <EmptyState icon="folder" message="Todavía no hay departamentos creados." />
          ) : (
            areasOrdenadas.map((area) => (
              <ResponsabilidadesArea
                key={area.id}
                area={area}
                puedeEditar={puedeEditar}
                usuarioId={user?.id}
                onCambio={refreshAreas}
              />
            ))
          )}
        </div>
      ) : (
        <Card className="organigrama-imagen-card">
          <img src={organigramaImg} alt="Organigrama de McDental" className="organigrama-imagen" />
        </Card>
      )}
    </div>
  );
}
