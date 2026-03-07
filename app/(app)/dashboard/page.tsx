import { PageHeader01 } from "@/packages/blocks/app/page-header-01";
import { KpiRow01 } from "@/packages/blocks/app/kpi-row-01";
import { DataTable01 } from "@/packages/blocks/app/data-table-01";

export default function DashboardPage() {
  return (
    <main style={{ padding: "24px" }}>
      <PageHeader01
        title="Dashboard"
        subtitle="Resumen operativo del sistema"
        actions={[{ label: "Nueva automatización", href: "/automatizaciones" }]}
      />
      <KpiRow01
        items={[
          { label: "Procesos activos", value: "18" },
          { label: "Ahorro estimado", value: "37 h/mes" },
          { label: "Incidencias abiertas", value: "3" },
        ]}
      />
      <DataTable01
        columns={["Cliente", "Estado", "Última ejecución"]}
        rows={[
          ["Empresa Norte", "Activo", "Hoy, 09:12"],
          ["Servicios Vega", "Revisión", "Ayer, 17:34"],
          ["Instalaciones Sur", "Activo", "Hoy, 08:01"],
        ]}
      />
    </main>
  );
}
