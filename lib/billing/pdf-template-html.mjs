const quantityFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
})

const percentFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const BILLING_PDF_ISSUER = {
  name: "Manuel García López",
  taxId: "43170260-L",
  email: "info@corteapp.es",
  website: "www.corteapp.es",
}

export function toPdfNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function formatPdfCurrency(value) {
  return `${toPdfNumber(value).toFixed(2)}€`
}

export function formatPdfQuantity(value) {
  return quantityFormatter.format(toPdfNumber(value))
}

export function formatPdfPercent(value) {
  return `${percentFormatter.format(toPdfNumber(value))}%`
}

export function formatPdfDate(value) {
  if (!value) {
    return ""
  }

  const [year, month, day] = String(value).slice(0, 10).split("-")
  if (!year || !month || !day) {
    return String(value)
  }

  return `${day}/${month}/${year}`
}

export function sanitizeBillingPdfFilePart(value) {
  return String(value ?? "documento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    || "documento"
}

export function buildGeneratedPdfFileName(document) {
  return `${sanitizeBillingPdfFilePart(document.document_number)}.pdf`
}

export function buildGeneratedPdfStoragePath(document) {
  return `${document.id}/generated/${buildGeneratedPdfFileName(document)}`
}

export function billingDocumentPdfLabels(documentType) {
  const isProforma = documentType === "proforma"

  return {
    title: isProforma ? "Proforma" : "Factura",
    dateLabel: isProforma ? "Fecha de Proforma" : "Fecha de Factura",
    numberLabel: isProforma ? "Nº de Proforma" : "Nº de Factura",
    paymentDateLabel: isProforma ? "Fecha de vencimiento" : "Fecha de cobro",
    paymentMethodLabel: "Método de pago",
    taxIdLabel: "CIF/NIF Cliente",
    conceptLabel: isProforma ? "Concepto proforma" : "Concepto factura",
  }
}

function paymentMethodLabel(value) {
  if (value === "stripe") {
    return "Stripe"
  }

  if (value === "sepa") {
    return "SEPA"
  }

  if (value === "transfer") {
    return "Transferencia"
  }

  if (value === "other") {
    return "Otro"
  }

  return ""
}

export function buildBillingDocumentPrintPayload({ document, lines, client, issuer = BILLING_PDF_ISSUER }) {
  const labels = billingDocumentPdfLabels(document.document_type)
  const resolvedClient = {
    name: document.client_name,
    taxId: document.client_tax_id ?? client?.tax_id ?? "",
    address: client?.address ?? "",
    contactName: client?.contact_name ?? "",
    contactPhone: client?.contact_phone ?? "",
    email: document.billing_email ?? client?.billing_email ?? client?.contact_email ?? "",
  }
  const concept = document.project || document.observations || ""

  return {
    issuer,
    labels,
    document,
    lines,
    client: resolvedClient,
    concept,
    paymentMethodLabel: paymentMethodLabel(document.payment_method ?? client?.payment_method),
    generatedFileName: buildGeneratedPdfFileName(document),
    generatedStoragePath: buildGeneratedPdfStoragePath(document),
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function optionalLine(value) {
  const text = String(value ?? "").trim()
  return text ? `<p>${escapeHtml(text)}</p>` : ""
}

function clientContactLine(client) {
  return [client.contactName, client.contactPhone].filter(Boolean).join(" ")
}

export const billingDocumentPrintStyles = `
@page {
  size: A4;
  margin: 0;
}

html,
body {
  background: #f4f4f4;
}

.billing-print-root {
  min-height: 100vh;
  padding: 16px;
  background: #f4f4f4;
}

.billing-page {
  position: relative;
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  padding: 0;
  box-sizing: border-box;
  background: #fff;
  color: #111;
  font-family: "Franklin Gothic Book", "FranklinGothic-Book", "Franklin Gothic", Calibri, Arial, sans-serif;
  font-size: 11pt;
  line-height: 1;
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.12);
}

.billing-logo {
  position: absolute;
  top: 24mm;
  left: 29.2mm;
  width: 40mm;
  height: auto;
}

.billing-watermark {
  position: absolute;
  top: 104mm;
  left: 31.8mm;
  width: 148mm;
  height: 89.1mm;
  object-fit: fill;
  opacity: 0.198;
  z-index: 0;
}

.billing-title {
  position: absolute;
  top: 27mm;
  right: 30mm;
  margin: 0;
  font-size: 18pt;
  font-weight: 700;
  z-index: 2;
}

.billing-parties {
  position: absolute;
  top: 55.95mm;
  left: 32mm;
  right: 30mm;
  display: grid;
  grid-template-columns: 62mm 1fr;
  gap: 20.5mm;
  font-size: 10.05pt;
  line-height: 1.11;
  z-index: 2;
}

.billing-party p {
  margin: 0;
}

.billing-email {
  color: #0563c1;
  text-decoration: underline;
}

.billing-meta {
  position: absolute;
  top: 82.3mm;
  left: 32mm;
  width: 150mm;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 9.95pt;
  line-height: 1.105;
  z-index: 2;
}

.billing-meta td {
  padding: 0 2mm 0 0;
  vertical-align: top;
}

.billing-meta td:nth-child(1) {
  width: 31.5mm;
}

.billing-meta td:nth-child(2) {
  width: 51mm;
}

.billing-meta td:nth-child(3) {
  width: 34mm;
}

.billing-meta td:nth-child(4) {
  width: 31.5mm;
}

.billing-meta .label {
  font-weight: 600;
}

.billing-concept {
  position: absolute;
  top: 103.7mm;
  left: 32mm;
  margin: 0;
  font-size: 10.15pt;
  line-height: 1.07;
  z-index: 2;
}

.billing-concept .label {
  display: inline-block;
  min-width: 31mm;
  font-weight: 600;
}

.billing-lines {
  position: absolute;
  top: 117.47mm;
  left: 30mm;
  width: 150.2mm;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 10pt;
  line-height: 1;
  z-index: 2;
}

.billing-lines col.code {
  width: 25mm;
}

.billing-lines col.description {
  width: 60mm;
}

.billing-lines col.quantity {
  width: 15mm;
}

.billing-lines col.unit-price {
  width: 18mm;
}

.billing-lines col.tax {
  width: 13mm;
}

.billing-lines col.total {
  width: 19mm;
}

.billing-lines th {
  border: 0.35mm solid #111;
  padding: 0.15mm 1.4mm;
  background: #b4c6e6;
  text-align: left;
  font-weight: 600;
}

.billing-lines td {
  border: 0.35mm solid #111;
  padding: 0.15mm 1.4mm;
  vertical-align: top;
}

.billing-lines .quantity {
  text-align: left;
}

.billing-lines .unit-price,
.billing-lines .tax,
.billing-lines .total {
  text-align: left;
}

.billing-totals {
  position: absolute;
  top: 135.8mm;
  right: 29.8mm;
  width: 42.5mm;
  border-collapse: collapse;
  font-size: 10pt;
  line-height: 1;
  z-index: 2;
}

.billing-totals td {
  border: 0.35mm solid #111;
  padding: 0.2mm 2mm;
}

.billing-totals .amount {
  text-align: left;
}

.billing-totals .grand-total td {
  font-weight: 700;
}

.billing-observations {
  position: absolute;
  top: 164mm;
  left: 30mm;
  margin: 0;
  white-space: pre-line;
  z-index: 2;
}

@media print {
  html,
  body {
    width: 210mm;
    min-height: 297mm;
    margin: 0;
    background: #fff;
  }

  .billing-print-root {
    padding: 0;
    background: #fff;
  }

  .billing-page {
    margin: 0;
    box-shadow: none;
  }
}
`

function assetUrl(assetPath, options) {
  const base = String(options.assetBaseUrl ?? "").replace(/\/$/g, "")
  return base ? `${base}${assetPath}` : assetPath
}

function buildBody(payload, options = {}) {
  const { document, issuer, client, labels, lines } = payload
  const paymentDate = document.document_type === "proforma" ? document.due_date : document.paid_date
  const logoUrl = assetUrl("/brand/corteges/logo-full.svg", options)
  const watermarkUrl = assetUrl("/brand/corteges/watermark.png", options)

  return `
<main class="billing-print-root">
  <article class="billing-page" aria-label="${escapeHtml(labels.title)} ${escapeHtml(document.document_number)}">
    <img class="billing-logo" src="${escapeHtml(logoUrl)}" alt="">
    <img class="billing-watermark" src="${escapeHtml(watermarkUrl)}" alt="">
    <h1 class="billing-title">${escapeHtml(labels.title)}</h1>

    <section class="billing-parties">
      <div class="billing-party">
        ${optionalLine(issuer.name)}
        ${optionalLine(issuer.taxId)}
        ${issuer.email ? `<p class="billing-email">${escapeHtml(issuer.email)}</p>` : ""}
        ${optionalLine(issuer.website)}
      </div>
      <div class="billing-party">
        ${optionalLine(client.name)}
        ${optionalLine(client.address)}
        ${optionalLine(clientContactLine(client))}
        ${optionalLine(client.email)}
      </div>
    </section>

    <table class="billing-meta" aria-label="Datos fiscales">
      <tbody>
        <tr>
          <td class="label">${escapeHtml(labels.dateLabel)}</td>
          <td class="value">${escapeHtml(formatPdfDate(document.issue_date))}</td>
          <td class="label">${escapeHtml(labels.numberLabel)}</td>
          <td class="value">${escapeHtml(document.document_number)}</td>
        </tr>
        <tr>
          <td class="label">${escapeHtml(labels.taxIdLabel)}</td>
          <td class="value">${escapeHtml(client.taxId)}</td>
          <td class="label">${escapeHtml(labels.paymentDateLabel)}</td>
          <td class="value">${escapeHtml(formatPdfDate(paymentDate))}</td>
        </tr>
        <tr>
          <td class="label">${escapeHtml(labels.paymentMethodLabel)}</td>
          <td class="value">${escapeHtml(payload.paymentMethodLabel)}</td>
          <td class="label"></td>
          <td class="value"></td>
        </tr>
      </tbody>
    </table>

    <p class="billing-concept"><span class="label">${escapeHtml(labels.conceptLabel)}:</span> ${escapeHtml(payload.concept)}</p>

    <table class="billing-lines" aria-label="Lineas">
      <colgroup>
        <col class="code">
        <col class="description">
        <col class="quantity">
        <col class="unit-price">
        <col class="tax">
        <col class="total">
      </colgroup>
      <thead>
        <tr>
          <th class="code">Denominación</th>
          <th class="description">Descripción</th>
          <th class="quantity">Cant.</th>
          <th class="unit-price">Precio/u</th>
          <th class="tax">IVA</th>
          <th class="total">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map((line) => `
        <tr>
          <td class="code">${escapeHtml(line.code || `Linea ${line.line_index}`)}</td>
          <td class="description">${escapeHtml(line.description)}</td>
          <td class="quantity">${escapeHtml(formatPdfQuantity(line.quantity))}</td>
          <td class="unit-price">${escapeHtml(formatPdfCurrency(line.unit_price))}</td>
          <td class="tax">${escapeHtml(formatPdfPercent(line.vat_rate))}</td>
          <td class="total">${escapeHtml(formatPdfCurrency(line.total_amount))}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>

    <table class="billing-totals" aria-label="Totales">
      <tbody>
        <tr>
          <td>SubTotal</td>
          <td class="amount">${escapeHtml(formatPdfCurrency(document.subtotal_amount))}</td>
        </tr>
        <tr>
          <td>Total IVA</td>
          <td class="amount">${escapeHtml(formatPdfCurrency(document.tax_amount))}</td>
        </tr>
        <tr class="grand-total">
          <td>TOTAL</td>
          <td class="amount">${escapeHtml(formatPdfCurrency(document.total_amount))}</td>
        </tr>
      </tbody>
    </table>

    ${document.observations && document.observations !== payload.concept ? `<p class="billing-observations">${escapeHtml(document.observations)}</p>` : ""}
  </article>
</main>`
}

export function buildBillingDocumentPrintHtml(payload, options = {}) {
  const body = `<style>${billingDocumentPrintStyles}</style>${buildBody(payload, options)}`

  if (!options.fullDocument) {
    return body
  }

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(payload.document.document_number)}</title>
  <style>${billingDocumentPrintStyles}</style>
</head>
<body>
${buildBody(payload, options)}
</body>
</html>`
}
