import { Section } from "@/packages/ui/primitives/section";
import { SectionHeader } from "@/packages/ui/composed/section-header";

type FeatureGrid01Props = {
  title: string;
  subtitle?: string;
  items: { title: string; description: string }[];
};

export function FeatureGrid01({
  title,
  subtitle,
  items,
}: FeatureGrid01Props) {
  return (
    <Section>
      <SectionHeader title={title} subtitle={subtitle} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
        {items.map((item) => (
          <article key={item.title} className="card" style={{ padding: "20px" }}>
            <h3 style={{ marginTop: 0 }}>{item.title}</h3>
            <p style={{ color: "var(--muted-foreground)", marginBottom: 0 }}>
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
