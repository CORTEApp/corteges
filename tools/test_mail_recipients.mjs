#!/usr/bin/env node
import assert from "node:assert/strict"

import { mailRecipientList, splitMailRecipients } from "../lib/mail/recipients.mjs"

assert.deepEqual(
  splitMailRecipients(["miguel.martin@edisoles.es;admon@dtv.es"]),
  ["miguel.martin@edisoles.es", "admon@dtv.es"],
)

assert.deepEqual(
  splitMailRecipients([" uno@example.com, dos@example.com\nTRES@example.com ", "dos@example.com"]),
  ["uno@example.com", "dos@example.com", "TRES@example.com"],
)

assert.deepEqual(
  mailRecipientList(["facturas@example.com; administracion@example.com"]),
  [{ email: "facturas@example.com" }, { email: "administracion@example.com" }],
)

console.log("Mail recipient tests passed")
