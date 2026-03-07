import { Section } from "@/packages/ui/primitives/section";

type LogoStrip01Props = {
  title?: string;
  items: string[];
};

export function LogoStrip01({ title, items }: LogoStrip01Props) {
  return (
    <Section>
      <div className="card" style={{ padding: "24px" }}>
        {title ? (
          <p style={{ marginTop: 0, color: "var(--muted-foreground)" }}>{title}</p>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "16px" }}>
          {items.map((item) => (
            <div key={item} style={{ padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
