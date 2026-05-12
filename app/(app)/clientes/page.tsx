import Link from "next/link";
import { Clock3, FileText, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FILTERS_LAYOUT_CLASS } from "@/components/ui/filter-sidebar-card";
import { ResourceListScreen } from "@/components/resource-screens";
import { ClientFiltersBar, ClientsTable } from "@/app/(app)/clientes/_components/client-list";
import { listClients } from "@/lib/clients/data";
import type { ClientFilters } from "@/lib/clients/types";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const filters: ClientFilters = {
    q: one(params.q),
    active: one(params.active) ?? "active",
    payment: one(params.payment) ?? "all",
  };
  const { clients } = await listClients(filters);
  const activeCount = clients.filter((client) => client.active).length;
  const documentCount = clients.reduce((total, client) => total + client.document_count, 0);
  const historyCount = clients.reduce((total, client) => total + client.history_count, 0);

  return (
    <ResourceListScreen
      header={{
        icon: <Users className="size-6" aria-hidden="true" />,
        title: "Clientes",
        subtitle: "Listado operativo: activo por defecto, mini-dashboard por cliente y edición separada.",
        actions: (
          <Button asChild>
            <Link href="/clientes/nuevo">
              <Plus aria-hidden="true" />
              Nuevo cliente
            </Link>
          </Button>
        ),
      }}
      metrics={[
        { label: "Clientes", value: String(clients.length), description: "Resultado del filtro actual", icon: <Users className="size-4" aria-hidden="true" /> },
        { label: "Activos", value: String(activeCount), tone: "success" },
        { label: "Documentos", value: String(documentCount), icon: <FileText className="size-4" aria-hidden="true" /> },
        { label: "Histórico", value: String(historyCount), icon: <Clock3 className="size-4" aria-hidden="true" /> },
      ]}
    >
      <div className={FILTERS_LAYOUT_CLASS}>
        <ClientFiltersBar filters={filters} />
        <div className="space-y-6">
          <ClientsTable clients={clients} />
        </div>
      </div>
    </ResourceListScreen>
  );
}
