#!/usr/bin/env node
import assert from "node:assert/strict"

import { calculateApprovalLineAmounts } from "../lib/billing/approval-amounts.mjs"

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

console.log("Billing approval amount tests passed")
