import { PageHeader01 } from "@/packages/blocks/app/page-header-01";
import { DataTable01 } from "@/packages/blocks/app/data-table-01";

export default function ClientesPage() {
  return (
    <main style={{ padding: "24px" }}>
      <PageHeader01
        title="Clientes"
        subtitle="Listado base con estructura reutilizable para CRM interno o gestión operativa"
      />
      <DataTable01
        columns={["Cliente", "Sector", "Estado"]}
        rows={[
          ["Empresa Norte", "Industrial", "Activo"],
          ["Servicios Vega", "Servicios", "Onboarding"],
          ["Instalaciones Sur", "Mantenimiento", "Activo"],
        ]}
      />
    </main>
  );
}
