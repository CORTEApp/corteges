import { PageHeader01 } from "@/packages/blocks/app/page-header-01";
import { DataTable01 } from "@/packages/blocks/app/data-table-01";
import { EmptyState01 } from "@/packages/blocks/app/empty-state-01";

export default function AutomatizacionesPage() {
  return (
    <main style={{ padding: "24px" }}>
      <PageHeader01
        title="Automatizaciones"
        subtitle="Vista base para listar flujos, estados y próximas acciones"
      />
      <DataTable01
        columns={["Flujo", "Estado", "Última ejecución"]}
        rows={[
          ["Alta de cliente", "Activo", "Hoy, 08:45"],
          ["Parte de trabajo", "Revisión", "Ayer, 18:20"],
          ["Recordatorio de cobro", "Pausado", "Hace 2 días"],
        ]}
      />
      <div style={{ marginTop: "16px" }}>
        <EmptyState01 />
      </div>
    </main>
  );
}
