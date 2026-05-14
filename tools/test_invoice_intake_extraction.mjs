import assert from "node:assert/strict"
import fs from "node:fs"
import Module, { createRequire } from "node:module"
import path from "node:path"
import ts from "typescript"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")
const require = createRequire(import.meta.url)
const originalResolve = Module._resolveFilename

Module._resolveFilename = function resolveWithAppAlias(request, parent, isMain, options) {
  if (typeof request === "string" && request.startsWith("@/")) {
    return originalResolve.call(this, path.join(rootDir, request.slice(2)), parent, isMain, options)
  }

  return originalResolve.call(this, request, parent, isMain, options)
}

Module._extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText

  module._compile(compiled, filename)
}

const {
  inferInvoiceDraft,
  normalizeTaxId,
  parseDateToIso,
  parseMoney,
} = require("../lib/expenses/invoice-intake/extraction.ts")

const suppliers = [
  {
    id: "supplier-openai",
    tax_id: "EU372041333",
    name: "OpenAI, LLC",
    active: true,
    contact_email: null,
  },
]

const openAiFixture = fs
  .readFileSync(path.join(rootDir, "tools", "fixtures", "invoice_intake_openai_stripe.txt"), "utf8")
  .replaceAll("{NUL}", "\u0000")

const openAiDraft = inferInvoiceDraft({
  text: openAiFixture,
  suppliers,
  templates: [],
})

assert.equal(openAiDraft.supplier_id, "supplier-openai")
assert.equal(openAiDraft.supplier_tax_id, "EU372041333")
assert.equal(openAiDraft.supplier_name, "OpenAI, LLC")
assert.equal(openAiDraft.invoice_number, "7B9E7642-0028")
assert.equal(openAiDraft.invoice_date, "2026-04-28")
assert.equal(openAiDraft.net_amount, 200)
assert.equal(openAiDraft.vat_rate, 21)
assert.equal(openAiDraft.total_amount, 242)
assert.equal(openAiDraft.currency, "USD")
assert.equal(openAiDraft.status, "extraida")
assert.equal(openAiDraft.last_error, null)
assert.equal(openAiDraft.extraction_data.extractor, "deterministic_pdf_text_v2")
assert.ok(openAiDraft.extraction_data.field_sources?.invoice_date)
assert.ok(openAiDraft.extraction_data.field_sources?.net_amount)

const spanishDraft = inferInvoiceDraft({
  text: [
    "Factura F-2026/001",
    "Fecha de emision 13/05/2026",
    "Proveedor de ejemplo SL",
    "CIF B12345678",
    "Base imponible 1.234,56 EUR",
    "IVA 21%",
    "Total factura 1.493,82 EUR",
  ].join("\n"),
  suppliers: [
    {
      id: "supplier-spanish",
      tax_id: "B12345678",
      name: "Proveedor de ejemplo SL",
      active: true,
      contact_email: null,
    },
  ],
  templates: [],
})

assert.equal(spanishDraft.supplier_id, "supplier-spanish")
assert.equal(spanishDraft.invoice_date, "2026-05-13")
assert.equal(spanishDraft.net_amount, 1234.56)
assert.equal(spanishDraft.total_amount, 1493.82)
assert.equal(spanishDraft.status, "extraida")

const missingSupplierDraft = inferInvoiceDraft({
  text: openAiFixture,
  suppliers: [],
  templates: [],
})

assert.equal(missingSupplierDraft.supplier_id, null)
assert.equal(missingSupplierDraft.status, "requiere_revision")
assert.deepEqual(missingSupplierDraft.extraction_data.missing_fields, ["proveedor"])

assert.equal(normalizeTaxId("EU OSS VAT EU372041333"), "EU372041333")
assert.equal(parseDateToIso("Date of issue February 5, 2024"), "2024-02-05")
assert.equal(parseDateToIso("13 de mayo de 2026"), "2026-05-13")
assert.equal(parseMoney("$200.00"), 200)
assert.equal(parseMoney("1.234,56 EUR"), 1234.56)

console.log("invoice intake extraction tests passed")
