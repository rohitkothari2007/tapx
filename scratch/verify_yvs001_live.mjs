async function verifyYvs001Live() {
  console.log("=== FINAL VERIFICATION FOR YVS001 LIVE ON VERCEL ===");

  const tapRes = await fetch("https://tapx-roan.vercel.app/tap/YVS001");
  console.log("1. GET /tap/YVS001 Status:", tapRes.status);
  const tapHtml = await tapRes.text();
  console.log("1. Response Length:", tapHtml.length);
  console.log("1. HTML Sample:", tapHtml.slice(0, 300));

  const tRes = await fetch("https://tapx-roan.vercel.app/t/YVS001", { redirect: "follow" });
  console.log("\n2. GET /t/YVS001 Status (followed redirect):", tRes.status);
  console.log("2. Final URL:", tRes.url);
  const tHtml = await tRes.text();
  console.log("2. Response Length:", tHtml.length);

  if (tapRes.status === 200 && tRes.status === 200 && tapHtml.length > 5000) {
    console.log("\n🎉 /tap/YVS001 AND /t/YVS001 ARE FULLY OPERATIONAL (HTTP 200 OK)!");
  } else {
    console.error("❌ CRASH OR FAILURE DETECTED!");
  }
}

verifyYvs001Live();
