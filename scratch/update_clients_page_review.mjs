import fs from "fs";

const filePath = "c:/Users/khush/Desktop/tapx/app/clients/page.tsx";
let code = fs.readFileSync(filePath, "utf-8");

code = code.replace(
  'description="Send customers directly to the business Google review page."',
  'description="Send customers directly to the business Google review page. Paste your Google Business review link, not your Maps location link."'
);

code = code.replace(
  'placeholder="https://g.page/your-business/review"',
  'placeholder="https://g.page/r/CXrdGmw-RmMwEBM/review"'
);

fs.writeFileSync(filePath, code, "utf-8");
console.log("Updated Google Review description in app/clients/page.tsx!");
