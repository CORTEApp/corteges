import { Section } from "@/packages/ui/primitives/section";
import { SectionHeader } from "@/packages/ui/composed/section-header";

export function Faq01() {
  return (
    <Section>
      <SectionHeader title="FAQ" subtitle="Stub inicial para iterar en P0." />
      <div className="card" style={{ padding: "24px" }}>Implementar acordeón de preguntas frecuentes.</div>
    </Section>
  );
}
