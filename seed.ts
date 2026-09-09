import * as dotenv from "dotenv";
dotenv.config();

import { supabaseAdmin } from "./src/integrations/supabase/client.server.ts";
import bcrypt from "bcryptjs";

async function seed() {
  const email = "test@centsibility.com";
  const password = "password123";
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
    const hashedPin = await bcrypt.hash("123456", 10);
    const { data: kid, error: kidError } = await supabaseAdmin
      .from("kids")
      .insert({
        parent_id: user.id,
        name: "Aiman",
        username: "aiman",
        login_code: "AIMAN1",
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
  console.log("Parent Login: test@centsibility.com / password123");
  console.log("Kid Login: aiman / 123456");
}

seed();
