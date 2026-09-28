import fs from "fs";

const filePath = "c:/Users/khush/Desktop/tapx/app/client/page.tsx";
let code = fs.readFileSync(filePath, "utf-8");

// 1. Add onUpdateBusiness prop to SettingsPage call site
const oldCall = `<SettingsPage\n              business={business}\n              email={currentUserEmail}\n            />`;
const newCall = `<SettingsPage\n              business={business}\n              email={currentUserEmail}\n              onUpdateBusiness={(updated) => setBusiness(updated)}\n            />`;

if (code.includes("email={currentUserEmail}\n            />")) {
  code = code.replace(
    "email={currentUserEmail}\n            />",
    "email={currentUserEmail}\n              onUpdateBusiness={(updated) => setBusiness(updated)}\n            />"
  );
  console.log("Updated call site!");
} else if (code.includes("email={currentUserEmail}\r\n            />")) {
  code = code.replace(
    "email={currentUserEmail}\r\n            />",
    "email={currentUserEmail}\r\n              onUpdateBusiness={(updated) => setBusiness(updated)}\r\n            />"
  );
  console.log("Updated call site (CRLF)!");
}

fs.writeFileSync(filePath, code, "utf-8");
console.log("File written successfully!");
