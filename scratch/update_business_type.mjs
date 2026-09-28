import fs from "fs";

const filePath = "c:/Users/khush/Desktop/tapx/app/client/page.tsx";
let code = fs.readFileSync(filePath, "utf-8");

const oldType = `type Business = {\n  id: string;\n  name: string;\n  category: string | null;\n  phone: string | null;\n  email: string | null;\n  address: string | null;\n  city: string | null;\n  state: string | null;\n  logo_url: string | null;\n  status: string | null;\n  instagram_url: string | null;\n  google_review_url: string | null;\n  whatsapp_number: string | null;\n  upi_id: string | null;\n};`;

const newType = `type Business = {\n  id: string;\n  name: string;\n  category: string | null;\n  phone: string | null;\n  email: string | null;\n  address: string | null;\n  city: string | null;\n  state: string | null;\n  logo_url: string | null;\n  status: string | null;\n  instagram_url: string | null;\n  google_review_url: string | null;\n  whatsapp_number: string | null;\n  upi_id: string | null;\n  payment_url?: string | null;\n  payment_enabled?: boolean | null;\n};`;

if (code.includes("upi_id: string | null;\n};")) {
  code = code.replace(
    "upi_id: string | null;\n};",
    "upi_id: string | null;\n  payment_url?: string | null;\n  payment_enabled?: boolean | null;\n};"
  );
} else if (code.includes("upi_id: string | null;\r\n};")) {
  code = code.replace(
    "upi_id: string | null;\r\n};",
    "upi_id: string | null;\r\n  payment_url?: string | null;\r\n  payment_enabled?: boolean | null;\r\n};"
  );
}

fs.writeFileSync(filePath, code, "utf-8");
console.log("Business type updated!");
