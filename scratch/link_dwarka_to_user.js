const ws = require('ws');
global.WebSocket = ws;

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envText.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('Signing in as admin rohitjkothari12@gmail.com...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'rohitjkothari12@gmail.com',
    password: 'Password123!',
  });

  if (authErr || !authData.session) {
    console.error('Auth error:', authErr);
    return;
  }

  const token = authData.session.access_token;
  console.log('Got session token! Calling /api/admin/create-owner...');

  const res = await fetch('http://localhost:3000/api/admin/create-owner', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      businessId: 'ec122dc0-b2f1-4d47-b3a8-c899dde5ccd1',
      ownerEmail: 'rohitjkothari12@gmail.com',
    }),
  });

  const json = await res.json();
  console.log('API Response:', res.status, json);
})();
