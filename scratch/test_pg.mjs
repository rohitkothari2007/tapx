import fs from "fs";

try {
  const pg = await import("pg");
  console.log("pg package is available!");
} catch (e) {
  console.log("pg package is not installed:", e.message);
}
