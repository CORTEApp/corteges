#!/usr/bin/env node
import assert from "node:assert/strict"

import { calculateApprovalLineAmounts } from "../lib/billing/approval-amounts.mjs"
import { summarizeBillingDocumentLineAmounts } from "../lib/billing/document-amounts.mjs"

function assertLineAmounts(input, expected) {
  const actual = calculateApprovalLineAmounts(input)

  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, `${key} should be ${value}, got ${actual[key]}`)
  }
}

assertLineAmounts(
  {
    recurringTotalAmount: 47.19,
    quantity: 1,
    applyVat: true,
    vatRate: 21,
  },
  {
    subtotalAmount: 39,
    taxAmount: 8.19,
    totalAmount: 47.19,
    unitPrice: 39,
    vatRate: 21,
  },
)

assertLineAmounts(
  {
    recurringTotalAmount: 21.78,
    quantity: 2,
    applyVat: true,
    vatRate: 21,
  },
  {
    subtotalAmount: 18,
    taxAmount: 3.78,
    totalAmount: 21.78,
    unitPrice: 9,
    vatRate: 21,
  },
)

assertLineAmounts(
  {
    recurringTotalAmount: 83.45,
    quantity: 5,
    applyVat: false,
    vatRate: 21,
  },
  {
    subtotalAmount: 83.45,
    taxAmount: 0,
    totalAmount: 83.45,
    unitPrice: 16.69,
    vatRate: 0,
  },
)

assert.deepEqual(
  summarizeBillingDocumentLineAmounts([
    { subtotal_amount: 100, tax_amount: 21, total_amount: 121 },
    { subtotal_amount: "50.25", tax_amount: "10.55", total_amount: "60.8" },
  ]),
  {
    subtotalAmount: 150.25,
    taxAmount: 31.55,
    totalAmount: 181.8,
  },
)

console.log("Billing approval amount tests passed")
