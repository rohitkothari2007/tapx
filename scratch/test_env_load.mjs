import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  console.log(".env.local contents:\n" + content);
} else {
  console.log(".env.local file not found.");
}
