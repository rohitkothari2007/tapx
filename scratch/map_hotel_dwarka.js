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
  console.log('Mapping HOTEL DWARKA to user 719ed228-8c65-44a9-8a89-0d5cd1a568e8...');

  const { data, error } = await supabase
    .from('tapx_client_users')
    .insert([
      {
        user_id: '719ed228-8c65-44a9-8a89-0d5cd1a568e8',
        business_id: 'ec122dc0-b2f1-4d47-b3a8-c899dde5ccd1',
        role: 'owner',
      },
    ]);

  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Successfully mapped HOTEL DWARKA to user!');
  }
})();
