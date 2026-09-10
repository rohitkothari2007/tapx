const url = "https://nzxmwerhrauqidinktgp.supabase.co/rest/v1/";
const key = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function fetchOpenAPI() {
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/openapi+json"
    }
  });
  const json = await res.json();
  if (json.definitions) {
    const tableNames = Object.keys(json.definitions);
    console.log(`Found ${tableNames.length} tables/views in OpenAPI schema:`);
    for (const name of tableNames) {
      console.log(`\n--- TABLE: ${name} ---`);
      const properties = json.definitions[name].properties || {};
      for (const [prop, meta] of Object.entries(properties)) {
        console.log(`  - ${prop}: ${meta.type} ${meta.format || ""}`);
      }
    }
  } else {
    console.log("OpenAPI response error:", json);
  }
}

fetchOpenAPI();
