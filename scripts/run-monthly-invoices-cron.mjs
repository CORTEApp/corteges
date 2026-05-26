#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_PATH = "/api/cron/billing/monthly-invoices";

function parseArgs(argv) {
  const args = {
    period: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--period") {
      args.period = argv[++i] || "";
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run cron:monthly-invoices -- [--period YYYY-MM-DD]");
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const secret = requiredEnv("CRON_SECRET");
  const baseUrl = (process.env.CRON_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const endpointPath = process.env.MONTHLY_INVOICES_CRON_PATH || DEFAULT_PATH;
  const url = new URL(endpointPath, baseUrl);

  if (args.period) {
    url.searchParams.set("period", args.period);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(120_000),
  });

  const text = await response.text();
  let body = text;
  try {
    body = JSON.stringify(JSON.parse(text));
  } catch {
    body = text.replace(/\s+/g, " ").slice(0, 1200);
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
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
