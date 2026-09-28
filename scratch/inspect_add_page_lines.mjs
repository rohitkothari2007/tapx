import fs from "fs";

const file = fs.readFileSync("app/clients/add/page.tsx", "utf-8");
const lines = file.split(/\r?\n/);
console.log(lines.slice(1125, 1145).join("\n"));
