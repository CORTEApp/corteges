import type { ReactNode } from "react";
type SectionProps = {
  children: ReactNode;
};

export function Section({ children }: SectionProps) {
  return (
    <section className="section">
      <div className="container">{children}</div>
    </section>
  );
}
