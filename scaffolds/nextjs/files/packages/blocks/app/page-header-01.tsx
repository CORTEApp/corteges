type PageHeaderAction = {
  label: string;
  href: string;
};

type PageHeader01Props = {
  title: string;
  subtitle?: string;
  actions?: PageHeaderAction[];
};

export function PageHeader01({
  title,
  subtitle,
  actions = [],
}: PageHeader01Props) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "start", marginBottom: "24px" }}>
      <div>
        <h1 style={{ margin: 0 }}>{title}</h1>
        {subtitle ? <p style={{ color: "var(--muted-foreground)" }}>{subtitle}</p> : null}
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {actions.map((action) => (
          <a key={action.href} href={action.href} className="button-primary">
            {action.label}
          </a>
        ))}
      </div>
    </header>
  );
}
