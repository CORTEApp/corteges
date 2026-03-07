import { Section } from "@/packages/ui/primitives/section";
import { SectionHeader } from "@/packages/ui/composed/section-header";
import { CtaBanner01 } from "@/packages/blocks/marketing/cta-banner-01";

export default function ContactoPage() {
  return (
    <main>
      <Section>
        <SectionHeader
          eyebrow="Contacto"
          title="Cuéntame qué necesitas ordenar"
          subtitle="Página base de demo/contacto lista para conectarse con formularios o calendarios."
        />
      </Section>
      <CtaBanner01
        title="Describe el problema y vemos el siguiente paso"
        subtitle="Esta ruta se deja creada para que no haya CTAs rotas en la shell inicial."
        primaryCta={{ label: "Ir al dashboard demo", href: "/dashboard" }}
      />
    </main>
  );
}
