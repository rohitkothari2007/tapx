import fs from "fs";

console.log("ENV KEYS:", Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("TAPX") || k.includes("NEXT")));
