async function traceRedirectChain(startUrl) {
  console.log(`\n========================================`);
  console.log(`TRACING REDIRECT CHAIN FOR: ${startUrl}`);
  console.log(`========================================`);

  let currentUrl = startUrl;
  let step = 0;
  const maxSteps = 10;

  while (step < maxSteps) {
    step++;
    console.log(`\nStep ${step}: Fetching ${currentUrl}`);
    const res = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    const location = res.headers.get("location");
    const vercelProtection = res.headers.get("x-vercel-protection-bypass");
    const vercelId = res.headers.get("x-vercel-id");

    if (location) {
      console.log(`--> Redirects to Location: ${location}`);
    }
    if (vercelProtection) {
      console.log(`--> Vercel Protection Header: ${vercelProtection}`);
    }
    if (vercelId) {
      console.log(`--> Vercel Edge Execution ID: ${vercelId}`);
    }

    if (res.status >= 300 && res.status < 400 && location) {
      // Resolve relative location URL
      currentUrl = new URL(location, currentUrl).href;
    } else {
      console.log(`Final Response Reached. Status: ${res.status}`);
      const text = await res.text();
      console.log(`Body Length: ${text.length} chars`);
      if (text.includes("This page couldn't load") || text.includes("Deployment Protection")) {
        console.log("⚠️ VERCEL ERROR / PROTECTION DETECTED IN BODY!");
      }
      break;
    }
  }

  if (step >= maxSteps) {
    console.log("❌ CRITICAL: REDIRECT LOOP DETECTED! (Exceeded 10 steps)");
  }
}

async function runTracing() {
  await traceRedirectChain("https://tapx-roan.vercel.app");
  await traceRedirectChain("https://tapx-roan.vercel.app/t/YVS001");
  await traceRedirectChain("https://tapx-roan.vercel.app/tap/YVS001");
}

runTracing();
