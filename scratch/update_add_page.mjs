import fs from "fs";

let content = fs.readFileSync("app/clients/add/page.tsx", "utf-8");

const oldSection = `                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>REGISTERED OWNER EMAIL</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                    {activatedClient.ownerEmail || "No email specified during setup"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>SHARED DASHBOARD ROUTE</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#2563eb", marginTop: "2px" }}>
                    /client
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    (Single shared URL — login automatically resolves owner's workspace)
                  </div>
                </div>`;

const newSection = `                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>REGISTERED OWNER ACCESS</div>
                  {activatedClient.ownerEmail ? (
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#059669", marginTop: "2px" }}>
                      📧 {activatedClient.ownerEmail}
                    </div>
                  ) : (
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#dc2626", marginTop: "2px" }}>
                      ⚠️ WARNING: No owner email set for {activatedClient.name}!
                    </div>
                  )}

                  {!activatedClient.ownerEmail && (
                    <div style={{ fontSize: "12px", color: "#991b1b", marginTop: "4px", lineHeight: "1.4" }}>
                      No owner email was assigned during setup. Without an owner email, nobody will be able to log in to access this client's portal. Please assign an owner email in Client Settings.
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>SHARED CLIENT PORTAL ROUTE</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#2563eb", marginTop: "2px" }}>
                    /client
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px", lineHeight: "1.5" }}>
                    <strong>/client</strong> is the universal login route for all client owners. When an owner logs in with their email, the system automatically resolves their business workspace.
                    {activatedClient.ownerEmail ? (
                      <span> Only logging in as <strong>{activatedClient.ownerEmail}</strong> will access <strong>{activatedClient.name}</strong>. If you visit <strong>/client</strong> while logged in as another account, you will see that account's workspace instead.</span>
                    ) : (
                      <span> Assign an owner email to allow login.</span>
                    )}
                  </div>
                </div>`;

// Replace normalizing newlines
const normContent = content.replace(/\r\n/g, "\n");
const normOld = oldSection.replace(/\r\n/g, "\n");
const normNew = newSection.replace(/\r\n/g, "\n");

if (normContent.includes(normOld)) {
  const updated = normContent.replace(normOld, normNew);
  fs.writeFileSync("app/clients/add/page.tsx", updated, "utf-8");
  console.log("Successfully replaced Owner Account Box!");
} else {
  console.error("Old section not found in file!");
}
