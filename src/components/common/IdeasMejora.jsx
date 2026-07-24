import PageHeader from "./PageHeader";
import Card from "./Card";
import Icon from "../ui/Icon";

// Reemplaza al viejo "Soporte TI". "Ideas de mejora" es un buzón de propuestas del personal que
// se conectará al módulo de MCTIC. Mientras esa integración no exista, se muestra como placeholder
// "en desarrollo" — a propósito, para no prometer algo que aún no funciona.
export default function IdeasMejora() {
  return (
    <div className="admin-page empleado-form-narrow">
      <PageHeader
        icon="lightbulb"
        title="Ideas de mejora"
        subtitle="Tu espacio para proponer mejoras a McDental."
      />

      <Card>
        <div className="mc-empty-state">
          <div className="mc-empty-state-icon">
            <Icon name="lightbulb" size={22} />
          </div>
          <div className="mc-empty-state-title">Módulo en desarrollo</div>
          <p className="mc-empty-state-message">
            Estamos construyendo este espacio. Pronto podrás enviar tus ideas y darles seguimiento;
            quedará conectado al módulo de MCTIC.
          </p>
        </div>
      </Card>
    </div>
  );
}
