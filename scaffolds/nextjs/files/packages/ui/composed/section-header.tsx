type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: "24px", maxWidth: "720px" }}>
      {eyebrow ? (
        <div style={{ color: "var(--primary)", fontWeight: 700, marginBottom: "8px" }}>
          {eyebrow}
        </div>
      ) : null}
      <h2 style={{ fontSize: "2rem", lineHeight: 1.1, margin: 0 }}>{title}</h2>
      {subtitle ? (
        <p style={{ color: "var(--muted-foreground)", fontSize: "1.05rem", marginTop: "12px" }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
