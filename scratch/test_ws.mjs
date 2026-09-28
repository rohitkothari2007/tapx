import fs from "fs";

try {
  const ws = await import("ws");
  console.log("ws package is available!");
} catch (e) {
  console.log("ws package error:", e.message);
}
