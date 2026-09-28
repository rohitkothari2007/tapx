async function testVercelDeploy() {
  console.log("=== CHECKING VERCEL LIVE URLS ===");

  try {
    const tapRes = await fetch("https://tapx-roan.vercel.app/tap/YVS001");
    console.log("\nGET /tap/YVS001 status:", tapRes.status);
    const tapText = await tapRes.text();
    console.log("GET /tap/YVS001 response length:", tapText.length);
    console.log("GET /tap/YVS001 html preview:", tapText.slice(0, 300));

    const tRes = await fetch("https://tapx-roan.vercel.app/t/YVS001", { redirect: "manual" });
    console.log("\nGET /t/YVS001 status:", tRes.status);
    console.log("GET /t/YVS001 redirect location:", tRes.headers.get("location"));
  } catch (err) {
    console.error("Vercel test error:", err);
  }
}

testVercelDeploy();
