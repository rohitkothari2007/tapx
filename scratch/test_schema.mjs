const url = 'https://nzxmwerhrauqidinktgp.supabase.co/rest/v1/devices?select=*&limit=5';
const key = 'sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q';

async function check() {
  const res = await fetch(url, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await res.json();
  console.log('Devices columns:', data[0] ? Object.keys(data[0]) : 'empty table', data);

  const iRes = await fetch('https://nzxmwerhrauqidinktgp.supabase.co/rest/v1/interactions?select=*&limit=5', {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const iData = await iRes.json();
  console.log('Interactions columns:', iData[0] ? Object.keys(iData[0]) : 'empty table', iData);
}

check();
