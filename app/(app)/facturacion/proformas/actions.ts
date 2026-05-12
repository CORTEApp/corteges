"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireBillingUser } from "@/lib/billing/data"
import { toNumber } from "@/lib/billing/format"
import type { BillingFacturableUnit, BillingPaymentMethod } from "@/lib/billing/types"
import { createClient } from "@/lib/supabase/server"

const PAYMENT_METHODS = new Set(["stripe", "sepa", "transfer", "other"])

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function requiredText(formData: FormData, key: string) {
  const value = textValue(formData, key)
  if (!value) {
    throw new Error(`Falta el campo obligatorio: ${key}`)
  }
  return value
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const value = textValue(formData, key)
  if (!value) {
    return fallback
  }

  const parsed = Number.parseFloat(value.replace(",", "."))
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor numerico invalido: ${key}`)
  }

  return parsed
}

function dateValue(formData: FormData, key: string, fallback = new Date().toISOString().slice(0, 10)) {
  const value = textValue(formData, key)
  if (!value) {
    return fallback
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Fecha invalida: ${key}`)
  }

  return value
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function cents(value: number | string | null | undefined) {
  return Math.round(toNumber(value) * 100)
}

function paymentMethodValue(formData: FormData): BillingPaymentMethod {
  const value = textValue(formData, "payment_method") ?? "other"
  return PAYMENT_METHODS.has(value) ? (value as BillingPaymentMethod) : "other"
}

async function getActionContext(nextPath: string) {
  const supabase = await createClient()
  const user = await requireBillingUser(supabase, nextPath)
  return { supabase, userId: user.id }
}

export async function createProformaAction(formData: FormData) {
  const { supabase, userId } = await getActionContext("/facturacion/proformas/nuevo")
  const clientId = requiredText(formData, "client_id")
  const issueDate = dateValue(formData, "issue_date")
  const issueYear = Number.parseInt(issueDate.slice(0, 4), 10)
  const dueDate = textValue(formData, "due_date")
  const rowCount = Math.min(Math.max(Number.parseInt(textValue(formData, "line_count") ?? "0", 10), 1), 20)

  const selectedRows = Array.from({ length: rowCount }, (_, index) => {
    const position = index + 1
    return {
      position,
      facturableId: textValue(formData, `line_facturable_id_${position}`),
      quantity: numberValue(formData, `line_quantity_${position}`, 0),
      vatRate: numberValue(formData, `line_vat_rate_${position}`, 21),
    }
  }).filter((line) => line.facturableId && line.quantity > 0)

  if (selectedRows.length === 0) {
    throw new Error("Anade al menos una linea facturable.")
  }

  const [{ data: client, error: clientError }, { data: facturables, error: facturablesError }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name, tax_id, billing_email")
        .eq("id", clientId)
        .maybeSingle(),
      supabase
        .from("billing_facturables")
        .select("id, code, description, unit_price, unit_type")
        .in("id", selectedRows.map((line) => line.facturableId)),
    ])

  if (clientError) {
    throw clientError
  }

  if (facturablesError) {
    throw facturablesError
  }

  if (!client) {
    throw new Error("Cliente no encontrado.")
  }

  const facturableById = new Map(
    ((facturables ?? []) as {
      id: string
      code: string
      description: string
      unit_price: number | string
      unit_type: BillingFacturableUnit
    }[]).map((facturable) => [facturable.id, facturable]),
  )

  const lines = selectedRows.map((row, index) => {
    const facturable = row.facturableId ? facturableById.get(row.facturableId) : null
    if (!facturable) {
      throw new Error("Una de las lineas seleccionadas ya no esta disponible.")
    }

    const unitPrice = toNumber(facturable.unit_price)
    const subtotal = roundMoney(unitPrice * row.quantity)
    const tax = roundMoney(subtotal * (row.vatRate / 100))

    return {
      line_index: index + 1,
      facturable_id: facturable.id,
      code: facturable.code,
      description: facturable.description,
      quantity: row.quantity,
      unit_price: unitPrice,
      vat_rate: row.vatRate,
      unit_type: facturable.unit_type,
      subtotal_amount: subtotal,
      tax_amount: tax,
      total_amount: roundMoney(subtotal + tax),
    }
  })

  const subtotal = roundMoney(lines.reduce((total, line) => total + line.subtotal_amount, 0))
  const tax = roundMoney(lines.reduce((total, line) => total + line.tax_amount, 0))
  const total = roundMoney(subtotal + tax)

  const { data: numberRows, error: numberError } = await supabase.rpc("next_billing_document_number", {
    p_document_type: "proforma",
    p_series: "P",
    p_number_year: issueYear,
  })

  if (numberError) {
    throw numberError
  }

  const numberRow = Array.isArray(numberRows) ? numberRows[0] : numberRows
  if (!numberRow?.document_number || !numberRow?.number_value) {
    throw new Error("No se pudo reservar numero de proforma.")
  }

  const { data: created, error: insertError } = await supabase
    .from("billing_documents")
    .insert({
      document_type: "proforma",
      status: "issued",
      payment_status: "unpaid",
      series: "P",
      number_year: issueYear,
      number_value: numberRow.number_value,
      document_number: numberRow.document_number,
      client_id: client.id,
      client_name: client.name,
      client_tax_id: client.tax_id,
      billing_email: client.billing_email,
      project: textValue(formData, "project"),
      issue_date: issueDate,
      due_date: dueDate,
      subtotal_amount: subtotal,
      tax_amount: tax,
      total_amount: total,
      observations: textValue(formData, "observations"),
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single()

  if (insertError) {
    throw insertError
  }

  const documentId = (created as { id: string }).id
  const { error: lineError } = await supabase
    .from("billing_document_lines")
    .insert(lines.map((line) => ({ ...line, document_id: documentId })))

  if (lineError) {
    throw lineError
  }

  revalidatePath("/facturacion/proformas")
  redirect(`/facturacion/proformas/${documentId}`)
}

export async function registerProformaPaymentAction(formData: FormData) {
  const proformaId = requiredText(formData, "proforma_id")
  const { supabase, userId } = await getActionContext(`/facturacion/proformas/${proformaId}`)
  const paymentDate = dateValue(formData, "payment_date")
  const amount = roundMoney(numberValue(formData, "amount", 0))
  const paymentMethod = paymentMethodValue(formData)

  const { data: proformaData, error } = await supabase
    .from("billing_documents")
    .select("*")
    .eq("id", proformaId)
    .eq("document_type", "proforma")
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!proformaData) {
    throw new Error("Proforma no encontrada.")
  }

  const proforma = proformaData as { total_amount: number | string; payment_status: string }
  if (proforma.payment_status === "paid") {
    throw new Error("La proforma ya esta marcada como pagada.")
  }

  if (cents(amount) !== cents(proforma.total_amount)) {
    throw new Error("En v1 solo se admite registrar el pago completo de la proforma.")
  }

  const { error: paymentError } = await supabase.from("billing_payments").insert({
    proforma_id: proformaId,
    amount,
    payment_date: paymentDate,
    payment_method: paymentMethod,
    notes: textValue(formData, "notes"),
    created_by: userId,
  })

  if (paymentError) {
    throw paymentError
  }

  const { error: updateError } = await supabase
    .from("billing_documents")
    .update({
      status: "paid",
      payment_status: "paid",
      paid_date: paymentDate,
      payment_method: paymentMethod,
      updated_by: userId,
    })
    .eq("id", proformaId)

  if (updateError) {
    throw updateError
  }

  revalidatePath("/facturacion/proformas")
  revalidatePath(`/facturacion/proformas/${proformaId}`)
  redirect(`/facturacion/proformas/${proformaId}`)
}

export async function issueInvoiceFromProformaAction(formData: FormData) {
  const proformaId = requiredText(formData, "proforma_id")
  const issueDate = dateValue(formData, "issue_date")
  const { supabase } = await getActionContext(`/facturacion/proformas/${proformaId}`)

  const { data, error } = await supabase.rpc("issue_invoice_from_paid_proforma", {
    p_proforma_id: proformaId,
    p_issue_date: issueDate,
  })

  if (error) {
    throw error
  }

  const invoiceId = Array.isArray(data) ? data[0] : data
  if (!invoiceId || typeof invoiceId !== "string") {
    throw new Error("No se pudo emitir la factura.")
  }

  revalidatePath("/facturacion/proformas")
  revalidatePath(`/facturacion/proformas/${proformaId}`)
  revalidatePath("/facturacion/facturas")
  redirect(`/facturacion/facturas/${invoiceId}`)
}
