type KpiRow01Props = {
  items: { label: string; value: string }[];
};

export function KpiRow01({ items }: KpiRow01Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "24px" }}>
      {items.map((item) => (
        <div key={item.label} className="card" style={{ padding: "16px" }}>
          <div style={{ color: "var(--muted-foreground)", fontSize: "0.9rem" }}>{item.label}</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
