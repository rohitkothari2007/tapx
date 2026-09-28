const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\khush\\.gemini\\antigravity\\brain\\1d85ac11-6c91-428e-acc8-17d432220648';

(async () => {
  console.log('Launching browser for multi-business resolution verification...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Go to Client Login page
    console.log('Navigating to client login page...');
    await page.goto('http://localhost:3000/client/login', { waitUntil: 'networkidle0' });

    // 2. Login with multi-business email rohitjkothari12@gmail.com
    console.log('Logging in as rohitjkothari12@gmail.com...');
    await page.type('input[type="email"]', 'rohitjkothari12@gmail.com');
    await page.type('input[type="password"]', 'Yuva@5666');
    await page.click('button[type="submit"]');

    await new Promise(r => setTimeout(r, 4000));

    // Remove ONLY tapx_selected_bId_ key (keep supabase auth token session intact!)
    await page.evaluate(() => {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tapx_selected_bId_')) {
          localStorage.removeItem(key);
        }
      });
    });

    // Reload /client without bId param to trigger multi-business picker screen
    await page.goto('http://localhost:3000/client', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 3000));

    // 3. Verify Picker Screen appears
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasPickerTitle = pageText.includes('Which business would you like to manage?');
    console.log('Page contains picker title "Which business would you like to manage?":', hasPickerTitle);

    const pickerScreenshotPath = path.join(artifactDir, 'multi_business_picker_modal.png');
    await page.screenshot({ path: pickerScreenshotPath, fullPage: true });
    console.log('Saved picker screenshot to:', pickerScreenshotPath);

    // 4. Click HOTEL DWARKA from picker
    console.log('Selecting HOTEL DWARKA from picker...');
    const clickedHotel = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.picker-item'));
      const item = items.find(el => el.innerText.includes('HOTEL DWARKA'));
      if (item) {
        item.click();
        return true;
      }
      return false;
    });

    console.log('Clicked HOTEL DWARKA item:', clickedHotel);
    await new Promise(r => setTimeout(r, 4000));

    const hotelText = await page.evaluate(() => document.body.innerText);
    console.log('Portal loaded contains HOTEL DWARKA:', hotelText.includes('HOTEL DWARKA'));

    const hotelScreenshotPath = path.join(artifactDir, 'multi_business_hotel_dwarka_loaded.png');
    await page.screenshot({ path: hotelScreenshotPath, fullPage: true });
    console.log('Saved Hotel Dwarka screenshot to:', hotelScreenshotPath);

    // 5. Test Switcher to YUVA SELECTION
    console.log('Testing business switcher to YUVA SELECTION...');
    const switchedToYuva = await page.evaluate(() => {
      const select = document.querySelector('.business-info select');
      if (select) {
        const opts = Array.from(select.options);
        const yOpt = opts.find(o => o.text.includes('YUVA SELECTION'));
        if (yOpt) {
          select.value = yOpt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    });

    console.log('Switched select dropdown to YUVA SELECTION:', switchedToYuva);
    await new Promise(r => setTimeout(r, 4000));

    const yuvaText = await page.evaluate(() => document.body.innerText);
    console.log('Portal loaded contains YUVA SELECTION:', yuvaText.includes('YUVA SELECTION'));

    const yuvaScreenshotPath = path.join(artifactDir, 'multi_business_yuva_selection_loaded.png');
    await page.screenshot({ path: yuvaScreenshotPath, fullPage: true });
    console.log('Saved Yuva Selection screenshot to:', yuvaScreenshotPath);

    // 6. Reload page to test localStorage persistence (no parameter in URL)
    console.log('Navigating to /client without params to test localStorage persistence...');
    await page.goto('http://localhost:3000/client', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 3000));

    const persistedText = await page.evaluate(() => document.body.innerText);
    console.log('Persisted load contains YUVA SELECTION:', persistedText.includes('YUVA SELECTION'));

    console.log('SUCCESS: All multi-business tests completed!');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
})();
