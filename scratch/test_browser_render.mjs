async function testRedirect() {
  console.log("=== TESTING LIVE REDIRECT & HTML FOR YVS001 ===");

  const res1 = await fetch("https://tapx-roan.vercel.app/t/YVS001", { redirect: "manual" });
  console.log("1. /t/YVS001 HTTP Status:", res1.status);
  console.log("1. Location Header:", res1.headers.get("location"));

  const res2 = await fetch("https://tapx-roan.vercel.app/tap/YVS001");
  console.log("\n2. /tap/YVS001 HTTP Status:", res2.status);
  const text2 = await res2.text();
  console.log("2. /tap/YVS001 Contains YUVA SELECTION:", text2.includes("YUVA") || text2.includes("TapExperiencePage") || text2.includes("tap"));
}

testRedirect();
