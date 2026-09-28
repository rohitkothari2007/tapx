import fs from "fs";

const envFile = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envFile.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(supabaseUrl, anonKey);

async function testAuthLogin() {
  console.log("Testing auth login to Supabase...");
  const start = Date.now();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "rohitjkothari12@gmail.com",
      password: "somepassword123",
    });
    console.log(`Auth result after ${Date.now() - start}ms:`, data, error);
  } catch (err) {
    console.error(`Auth exception after ${Date.now() - start}ms:`, err);
  }
}

testAuthLogin();
