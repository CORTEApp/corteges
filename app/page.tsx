import { HeroSaas01 } from "@/packages/blocks/marketing/hero-saas-01";
import { LogoStrip01 } from "@/packages/blocks/marketing/logo-strip-01";
import { FeatureGrid01 } from "@/packages/blocks/marketing/feature-grid-01";
import { CtaBanner01 } from "@/packages/blocks/marketing/cta-banner-01";
import { Footer01 } from "@/packages/blocks/marketing/footer-01";

export default function HomePage() {
  return (
    <main>
      <HeroSaas01
        eyebrow="Automatización interna para PYMES"
        title="Procesos más claros. Menos trabajo manual."
        subtitle="Soluciones de gestión interna y automatización, con foco en operativa real."
        primaryCta={{ label: "Solicitar demo", href: "/contacto" }}
        secondaryCta={{ label: "Ver casos", href: "/casos" }}
      />
      <LogoStrip01
        title="Equipos que necesitan ordenar su operativa"
        items={["Ventas", "Operaciones", "Administración", "Servicios"]}
      />
      <FeatureGrid01
        title="Qué resuelve el sistema"
        items={[
          { title: "Datos conectados", description: "Menos islas de información." },
          { title: "Procesos repetibles", description: "Menos dependencia de personas concretas." },
          { title: "Automatización real", description: "Menos tareas manuales y más trazabilidad." },
        ]}
      />
      <CtaBanner01
        title="Convierte procesos sueltos en un sistema útil"
        subtitle="Definimos el flujo, los datos y la automatización."
        primaryCta={{ label: "Hablar contigo", href: "/contacto" }}
      />
      <Footer01 />
    </main>
  );
}
