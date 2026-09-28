import fs from "fs";

let content = fs.readFileSync("app/clients/add/page.tsx", "utf-8");

const oldButtons = `<div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => router.push(\`/clients/\${activatedClient.id}\`)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#111827",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Manage Client Workspace
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/clients")}
                  style={{
                    padding: "12px 18px",
                    background: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    color: "#334155",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Back to Clients
                </button>
              </div>`;

const newButtons = `<div style={{ display: "flex", gap: "10px", marginTop: "auto", flexDirection: "column" }}>
                <button
                  type="button"
                  onClick={() => router.push(\`/clients/\${activatedClient.id}\`)}
                  style={{
                    width: "100%",
                    padding: "13px 18px",
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                  }}
                >
                  <span>↗</span> Open {activatedClient.name}'s Dashboard (Admin Side)
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/clients")}
                  style={{
                    width: "100%",
                    padding: "11px 18px",
                    background: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    color: "#334155",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  ← Back to All Clients
                </button>
              </div>`;

const normContent = content.replace(/\r\n/g, "\n");
const normOld = oldButtons.replace(/\r\n/g, "\n");
const normNew = newButtons.replace(/\r\n/g, "\n");

if (normContent.includes(normOld)) {
  const updated = normContent.replace(normOld, normNew);
  fs.writeFileSync("app/clients/add/page.tsx", updated, "utf-8");
  console.log("Successfully replaced Client Ready buttons!");
} else {
  console.error("Old buttons section not found in file!");
}
