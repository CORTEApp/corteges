import type { ReactNode } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MobileRecordCard, MobileRecordField, MobileRecordGrid } from "@/components/ui/mobile-record-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type UserManagementTableRow = {
  email: ReactNode
  displayName: ReactNode
  status: ReactNode
  deactivationDate: ReactNode
  createdAt: ReactNode
  lastSignIn: ReactNode
  roles: ReactNode
  actions: ReactNode
}

export function UserManagementTable({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: UserManagementTableRow[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Baja</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.displayName}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.deactivationDate}</TableCell>
                  <TableCell>{row.createdAt}</TableCell>
                  <TableCell>{row.lastSignIn}</TableCell>
                  <TableCell>{row.roles}</TableCell>
                  <TableCell className="text-right">{row.actions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 md:hidden">
          {rows.map((row, index) => (
            <MobileRecordCard key={index} eyebrow="Usuario" title={row.email} subtitle={row.displayName} footer={row.actions}>
              <MobileRecordGrid className="grid-cols-2">
                <MobileRecordField label="Estado" value={row.status} />
                <MobileRecordField label="Baja" value={row.deactivationDate} />
                <MobileRecordField label="Último acceso" value={row.lastSignIn} />
                <MobileRecordField label="Creado" value={row.createdAt} />
              </MobileRecordGrid>
              <MobileRecordField label="Roles" value={<div className="flex flex-wrap gap-2">{row.roles}</div>} />
            </MobileRecordCard>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
