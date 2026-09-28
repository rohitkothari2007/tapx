import fs from "fs";

const filePath = "c:/Users/khush/Desktop/tapx/app/clients/add/page.tsx";
let code = fs.readFileSync(filePath, "utf-8");

const oldCodeBlock = `async function copyToClipboard(text: string, type: "customer" | "portal") {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      if (type === "customer") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        setCopiedPortal(true);
        setTimeout(() => setCopiedPortal(false), 2500);
      }
    } catch (err) {
      console.error("Clipboard copy error:", err);
    }
  }

  async function copyCustomerUrl() {
    if (activatedClient?.customerUrl) {
      await copyToClipboard(activatedClient.customerUrl, "customer");
    }
  }`;

// Ensure copyToClipboard is placed directly inside AddClientPage main component scope
code = code.replace(
  "async function copyCustomerUrl() {",
  `async function copyToClipboard(text: string, type: "customer" | "portal") {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      if (type === "customer") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        setCopiedPortal(true);
        setTimeout(() => setCopiedPortal(false), 2500);
      }
    } catch (err) {
      console.error("Clipboard copy error:", err);
    }
  }

  async function copyCustomerUrl() {`
);

fs.writeFileSync(filePath, code, "utf-8");
console.log("Fixed copyToClipboard function placement!");
