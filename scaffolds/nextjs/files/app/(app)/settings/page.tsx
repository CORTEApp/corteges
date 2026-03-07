import { PageHeader01 } from "@/packages/blocks/app/page-header-01";
import { SettingsForm01 } from "@/packages/blocks/app/settings-form-01";

export default function SettingsPage() {
  return (
    <main style={{ padding: "24px" }}>
      <PageHeader01
        title="Ajustes"
        subtitle="Superficie base para configuración del espacio, preferencias y seguridad"
      />
      <SettingsForm01 />
    </main>
  );
}
