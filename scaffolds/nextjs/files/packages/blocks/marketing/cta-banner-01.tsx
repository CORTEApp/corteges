import { Button } from "@/packages/ui/primitives/button";
import { Section } from "@/packages/ui/primitives/section";

type CtaBanner01Props = {
  title: string;
  subtitle?: string;
  primaryCta: { label: string; href: string };
};

export function CtaBanner01({
  title,
  subtitle,
  primaryCta,
}: CtaBanner01Props) {
  return (
    <Section>
      <div
        className="card"
        style={{
          padding: "32px",
          display: "grid",
          gap: "16px",
          alignItems: "center",
          background: "linear-gradient(180deg, var(--card), var(--secondary))"
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {subtitle ? (
            <p style={{ color: "var(--muted-foreground)" }}>{subtitle}</p>
          ) : null}
        </div>
        <div>
          <Button href={primaryCta.href}>{primaryCta.label}</Button>
        </div>
      </div>
    </Section>
  );
}
