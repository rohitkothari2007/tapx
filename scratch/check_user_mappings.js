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
  console.log('Checking tapx_admin_users...');

  const { data: adminUsers, error: aErr } = await supabase
    .from('tapx_admin_users')
    .select('*');
  console.log('All tapx_admin_users:', adminUsers, aErr);
})();
