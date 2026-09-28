import { readFileSync } from 'fs';

const envLines = readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    const key = line.substring(0, idx).trim();
    const val = line.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function getAllTables() {
  // Fetch OpenAPI spec from PostgREST root endpoint
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: { 'apikey': anonKey }
  });
  const data = await res.json();
  const paths = Object.keys(data.paths || {}).map(p => p.replace('/', ''));
  console.log("All tables exposed in PostgREST OpenAPI spec:", paths);
}

getAllTables();
