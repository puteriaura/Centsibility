import * as dotenv from "dotenv";
dotenv.config({ quiet: true });

import { supabaseAdmin } from "./scripts/lib/supabase-admin.ts";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "node:crypto";

export function assertSeedTarget(rawUrl: string, stagingUrl?: string): void {
  const url = new URL(rawUrl);
  if ((rawUrl.includes("uoghvqciodboxhfopuip") || url.hostname.includes("uoghvqciodboxhfopuip")) ||
      url.username || url.password ||
      !["http:", "https:"].includes(url.protocol) ||
      (!["localhost", "127.0.0.1"].includes(url.hostname) &&
       (!stagingUrl || rawUrl !== stagingUrl))) {
    throw new Error("Seeding requires localhost or an explicitly selected staging project; production is forbidden.");
  }
}

async function seed() {
  assertSeedTarget(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "", process.env.STAGING_SUPABASE_URL);
  const email = "test@centsibility.com";
  const password = randomBytes(24).toString("base64url");
  const name = "Test Parent";

  console.log("Checking if user exists...");
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }
  let user = users.find(u => u.email === email);

  if (!user) {
    console.log("Creating user...");
    const { data: { user: newUser }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name }
    });
    if (createError) {
      console.error("Error creating user:", createError);
      return;
    }
    user = newUser;
    console.log("User created:", user.id);
  } else {
    console.log("User already exists:", user.id);
    // Ensure confirmed
    await supabaseAdmin.auth.admin.updateUserById(user.id, { email_confirm: true });
  }

  // Create kid
  const { data: existingKid } = await supabaseAdmin
    .from("kids")
    .select("id")
    .eq("parent_id", user.id)
    .eq("name", "Aiman")
    .maybeSingle();

  if (!existingKid) {
    console.log("Creating kid Aiman...");
    let pin: string;
    do { pin = String(randomInt(0, 1_000_000)).padStart(6, "0"); } while (pin === "123456");
    const hashedPin = await bcrypt.hash(pin, 10);
    const { data: kid, error: kidError } = await supabaseAdmin
      .from("kids")
      .insert({
        parent_id: user.id,
        name: "Aiman",
        username: "aiman",
        login_code: null,
        hashed_pin: hashedPin,
        balance: 100,
        coins: 500
      })
      .select()
      .single();
    if (kidError) {
      console.error("Error creating kid:", kidError);
      return;
    }
    console.log("Kid created:", kid.id);
  } else {
    console.log("Kid already exists.");
  }

  console.log("Seed complete!");
}

if (import.meta.main) seed();
