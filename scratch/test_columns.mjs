const url = "https://nzxmwerhrauqidinktgp.supabase.co/rest/v1/";
const key = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

const candidateCols = [
  "details",
  "request_details",
  "message",
  "note",
  "location",
  "unit",
  "room",
  "table",
  "payload",
  "metadata",
  "items",
  "updated_at"
];

async function checkCols() {
  console.log("=== CHECKING MORE CUSTOMER_REQUESTS COLUMNS ===");
  for (const col of candidateCols) {
    const res = await fetch(`${url}customer_requests?select=${col}&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    const err = await res.json();
    if (res.status === 200 || res.status === 401) {
      console.log(`Column '${col}': VALID (Status ${res.status})`);
    } else {
      console.log(`Column '${col}': INVALID (${res.status})`);
    }
  }
}

checkCols();
