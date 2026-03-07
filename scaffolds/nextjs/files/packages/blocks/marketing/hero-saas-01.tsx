import { Button } from "@/packages/ui/primitives/button";
import { Section } from "@/packages/ui/primitives/section";

type HeroSaas01Props = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

export function HeroSaas01({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
}: HeroSaas01Props) {
  return (
    <Section>
      <div style={{ display: "grid", gap: "24px", paddingBlock: "32px" }}>
        {eyebrow ? (
          <div style={{ color: "var(--primary)", fontWeight: 700 }}>{eyebrow}</div>
        ) : null}
        <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1, margin: 0, maxWidth: "12ch" }}>
          {title}
        </h1>
        <p style={{ color: "var(--muted-foreground)", maxWidth: "60ch", fontSize: "1.1rem" }}>
          {subtitle}
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Button href={primaryCta.href}>{primaryCta.label}</Button>
          {secondaryCta ? (
            <Button href={secondaryCta.href} variant="secondary">
              {secondaryCta.label}
            </Button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
