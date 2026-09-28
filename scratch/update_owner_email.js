const puppeteer = require('puppeteer-core');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('Logging in as Admin to update HOTEL DWARKA owner email...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle0' });

    await page.type('input[type="email"]', 'rohitjkothari12@gmail.com');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await new Promise(r => setTimeout(r, 3000));
    console.log('Current Admin URL:', page.url());

    // Navigate to /clients (Manage Clients)
    await page.goto('http://localhost:3000/clients', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    // Find HOTEL DWARKA and click "Manage" or "Edit" button
    const openedModal = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, .client-card, .client-row'));
      const hotelRow = rows.find(r => r.innerText.includes('HOTEL DWARKA'));
      if (hotelRow) {
        const btn = hotelRow.querySelector('button');
        if (btn) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    console.log('Opened manage modal for HOTEL DWARKA:', openedModal);
    await new Promise(r => setTimeout(r, 1500));

    // Fill "Owner Login Email" input field with rohitjkothari12@gmail.com
    const filledEmail = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      // Look for owner login email input
      const emailInput = inputs.find(i => i.placeholder?.includes('owner@example.com') || i.value?.includes('@'));
      if (emailInput) {
        emailInput.value = 'rohitjkothari12@gmail.com';
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    });

    console.log('Filled owner login email:', filledEmail);

    // Save changes
    const saved = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find(b => b.innerText.includes('Save') || b.innerText.includes('Update'));
      if (saveBtn) {
        saveBtn.click();
        return true;
      }
      return false;
    });

    console.log('Clicked Save button:', saved);
    await new Promise(r => setTimeout(r, 3000));

    console.log('Admin update completed!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
