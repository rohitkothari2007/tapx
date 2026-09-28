import fs from "fs";

const envText = fs.readFileSync(".env.local", "utf8");
console.log(".env.local contents:");
console.log(envText);
