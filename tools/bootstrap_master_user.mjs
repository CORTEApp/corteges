import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseDotenvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const index = trimmed.indexOf("=");
  if (index === -1) return null;

  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseDotenvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    process.env[key] ??= value;
  }
}

async function findUserByEmail(admin, email) {
  const perPage = 1000;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < perPage) return null;
  }

  throw new Error("Too many auth users to scan safely");
}

async function syncMasterProfile(admin, userId, email) {
  const displayName = email.split("@")[0] || "Master";

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: userId,
    email,
    display_name: displayName,
    role: "master",
    preferred_language: "es",
    preferred_theme: "saas_atlas_blue_v2",
    color_mode: "system",
    text_size: "medium",
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (profileError && profileError.code !== "42P01" && profileError.code !== "42703") {
    throw profileError;
  }

  const { error: roleError } = await admin.from("app_user_roles").upsert({
    user_id: userId,
    role: "master",
  }, { onConflict: "user_id,role" });

  if (roleError && roleError.code !== "42P01") {
    throw roleError;
  }
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.user_master ?? process.env.USER_MASTER;
  const password = process.env.user_master_password ?? process.env.USER_MASTER_PASSWORD;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
  if (!email) throw new Error("Missing user_master");
  if (!password) throw new Error("Missing user_master_password");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const existing = await findUserByEmail(admin, email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        role: "master",
        roles: Array.from(new Set([...(Array.isArray(existing.user_metadata?.roles) ? existing.user_metadata.roles : []), "master"])),
        bootstrap_master: true,
      },
    });
    if (error) throw error;
    await syncMasterProfile(admin, existing.id, email);
    console.log("Master user updated");
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "master",
      roles: ["master"],
      bootstrap_master: true,
    },
  });
  if (error) throw error;
  if (data.user) {
    await syncMasterProfile(admin, data.user.id, email);
  }

  console.log("Master user created");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
