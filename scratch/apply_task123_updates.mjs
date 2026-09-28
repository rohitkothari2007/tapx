import fs from "fs";

// 1. Update app/client/page.tsx (Settings helper text)
const clientPagePath = "c:/Users/khush/Desktop/tapx/app/client/page.tsx";
let clientCode = fs.readFileSync(clientPagePath, "utf-8");

const oldReviewField = `<div className="input-group">
            <label>Google Review Link</label>
            <input
              type="url"
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/.../review"
            />
          </div>`;

const newReviewField = `<div className="input-group">
            <label>Google Review Link</label>
            <input
              type="url"
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/CXrdGmw-RmMwEBM/review"
            />
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
              Paste your Google Business review link, not your Maps location link
            </span>
          </div>`;

if (clientCode.includes(oldReviewField)) {
  clientCode = clientCode.replace(oldReviewField, newReviewField);
  console.log("Updated google review field helper text in app/client/page.tsx!");
} else {
  console.warn("Could not find exact oldReviewField pattern in app/client/page.tsx, attempting regex...");
  clientCode = clientCode.replace(
    /placeholder="https:\/\/g\.page\/r\/\.\.\.\/review"/,
    `placeholder="https://g.page/r/CXrdGmw-RmMwEBM/review"`
  );
}

fs.writeFileSync(clientPagePath, clientCode, "utf-8");

// 2. Update app/clients/add/page.tsx (Copy handlers, owner status badge, review helper text)
const addPagePath = "c:/Users/khush/Desktop/tapx/app/clients/add/page.tsx";
let addCode = fs.readFileSync(addPagePath, "utf-8");

// Add copiedPortal state
if (!addCode.includes("const [copiedPortal, setCopiedPortal] = useState(false);")) {
  addCode = addCode.replace(
    "const [copied, setCopied] = useState(false);",
    "const [copied, setCopied] = useState(false);\n  const [copiedPortal, setCopiedPortal] = useState(false);"
  );
}

// Update copy function with robust clipboard + fallback
const oldCopyFunc = `async function copyCustomerUrl() {
    if (!activatedClient?.customerUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        activatedClient.customerUrl
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error(
        "Unable to copy URL:",
        err
      );
    }
  }`;

const newCopyFunc = `async function copyToClipboard(text: string, type: "customer" | "portal") {
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

addCode = addCode.replace(oldCopyFunc, newCopyFunc);

// Update Copy Dashboard URL button onClick
addCode = addCode.replace(
  `onClick={() => navigator.clipboard.writeText(portalUrl)}`,
  `onClick={() => copyToClipboard(portalUrl, "portal")}`
);

addCode = addCode.replace(
  `Copy Dashboard URL`,
  `{copiedPortal ? "✓ Copied Dashboard URL" : "Copy Dashboard URL"}`
);

// Add helper text under Google Review input in clients/add
addCode = addCode.replace(
  `placeholder="https://g.page/business/review"`,
  `placeholder="https://g.page/r/CXrdGmw-RmMwEBM/review"`
);

fs.writeFileSync(addPagePath, addCode, "utf-8");
console.log("Updated copy handlers and Google Review helper text in app/clients/add/page.tsx!");
