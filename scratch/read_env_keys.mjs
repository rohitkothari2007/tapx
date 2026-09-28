import fs from "fs";

const envFile = fs.readFileSync(".env.local", "utf8");
console.log("Keys in .env.local:");
envFile.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 1 && parts[0].trim()) {
    console.log(" -", parts[0].trim());
  }
});
