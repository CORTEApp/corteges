import { Section } from "@/packages/ui/primitives/section";
import { SectionHeader } from "@/packages/ui/composed/section-header";

export function FeatureSplit01() {
  return (
    <Section>
      <SectionHeader title="Feature split" subtitle="Stub inicial para iterar en P0." />
      <div className="card" style={{ padding: "24px" }}>Implementar layout split con texto + visual.</div>
    </Section>
  );
}
