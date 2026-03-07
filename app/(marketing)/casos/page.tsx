import { Section } from "@/packages/ui/primitives/section";
import { SectionHeader } from "@/packages/ui/composed/section-header";
import { FeatureGrid01 } from "@/packages/blocks/marketing/feature-grid-01";
import { Footer01 } from "@/packages/blocks/marketing/footer-01";

export default function CasosPage() {
  return (
    <main>
      <Section>
        <SectionHeader
          eyebrow="Casos"
          title="Ejemplos base para aterrizar propuesta y resultados"
          subtitle="Ruta de apoyo para demo comercial y para evitar enlaces internos rotos desde la home."
        />
      </Section>
      <FeatureGrid01
        title="Casos tipo"
        items={[
          { title: "Operativa comercial", description: "Seguimiento, pipeline y automatización de avisos." },
          { title: "Gestión interna", description: "Unificación de datos y trazabilidad de tareas." },
          { title: "Servicio posventa", description: "Colas, prioridades y estados visibles para el equipo." },
        ]}
      />
      <Footer01 />
    </main>
  );
}
