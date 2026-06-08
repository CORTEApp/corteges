#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_PATH = "/api/cron/expenses/recover-pdfs-from-mail";

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: "",
    maxMessages: "",
    maxPdfTextInspections: "",
    matchMode: "",
    folderId: "",
    candidateOrder: "",
    noInspectPdfText: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--limit") {
      args.limit = argv[++index] || "";
    } else if (arg === "--max-messages") {
      args.maxMessages = argv[++index] || "";
    } else if (arg === "--max-pdf-text-inspections") {
      args.maxPdfTextInspections = argv[++index] || "";
    } else if (arg === "--match-mode") {
      args.matchMode = argv[++index] || "";
    } else if (arg === "--folder-id") {
      args.folderId = argv[++index] || "";
    } else if (arg === "--candidate-order") {
      args.candidateOrder = argv[++index] || "";
    } else if (arg === "--no-inspect-pdf-text") {
      args.noInspectPdfText = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run cron:expense-pdf-recovery -- [--dry-run] [--limit N] [--max-messages N] [--max-pdf-text-inspections N] [--match-mode invoice|balanced] [--folder-id all|inbox|sentitems] [--candidate-order random|newest|oldest] [--no-inspect-pdf-text]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function sanitizeBody(text) {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/refresh_token=[^&\s]+/gi, "refresh_token=[redacted]")
    .replace(/Invalid key:\s*[^\s]+/gi, "Invalid key: [redacted]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/mail\/[^\s]+/gi, "[storage-key-redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 1600);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const secret = requiredEnv("CRON_SECRET");
  const baseUrl = (process.env.CRON_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const endpointPath = process.env.EXPENSE_PDF_RECOVERY_CRON_PATH || DEFAULT_PATH;
  const url = new URL(endpointPath, baseUrl);

  if (args.dryRun) url.searchParams.set("dry_run", "1");
  if (args.limit) url.searchParams.set("limit", args.limit);
  if (args.maxMessages) url.searchParams.set("max_messages", args.maxMessages);
  if (args.maxPdfTextInspections) url.searchParams.set("max_pdf_text_inspections", args.maxPdfTextInspections);
  if (args.matchMode) url.searchParams.set("match_mode", args.matchMode);
  if (args.folderId) url.searchParams.set("folder_id", args.folderId);
  if (args.candidateOrder) url.searchParams.set("candidate_order", args.candidateOrder);
  if (args.noInspectPdfText) url.searchParams.set("inspect_pdf_text", "0");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(300_000),
  });

  const text = await response.text();
  let body = text;
  try {
    body = JSON.stringify(JSON.parse(text));
  } catch {
    body = sanitizeBody(text);
  }

  console.log(
    JSON.stringify({
      ok: response.ok,
      status: response.status,
      path: `${url.pathname}${url.search}`,
      body,
    }),
  );

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? sanitizeBody(error.message) : sanitizeBody(String(error)));
  process.exit(1);
});
