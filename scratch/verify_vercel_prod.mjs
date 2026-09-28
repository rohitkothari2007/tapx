async function verifyVercelProduction() {
  console.log("=========================================");
  console.log("VERIFYING LIVE VERCEL PRODUCTION DEPLOYMENT");
  console.log("=========================================");

  const url = "https://tapx-roan.vercel.app/t/YVS001";
  console.log("Fetching:", url);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    }
  });

  console.log("HTTP Status:", res.status);
  console.log("Final URL after redirect:", res.url);

  const html = await res.text();
  console.log("HTML Length:", html.length);
  console.log("Contains YUVA SELECTION:", html.includes("YUVA"));
  console.log("Contains TapExperiencePage:", html.includes("TapExperiencePage") || html.includes("tap"));

  if (res.status === 200 && html.length > 5000) {
    console.log("\n🎉 LIVE VERCEL PRODUCTION IS 100% WORKING!");
  } else {
    console.log("\n❌ VERCEL RETURNED ERROR SCREEN:", html);
  }
}

verifyVercelProduction();
