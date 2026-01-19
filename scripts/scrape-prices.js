const puppeteer = require('puppeteer');

const API_URL = process.env.API_URL;
const UPDATE_PRICES_SECRET = process.env.UPDATE_PRICES_SECRET;

async function fetchProductUrls() {
  const response = await fetch(`${API_URL}/api/update-prices`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${UPDATE_PRICES_SECRET}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch product URLs: ${response.status}`);
  }

  return response.json();
}

async function scrapeCostcoProduct(page, url) {
  try {
    console.log(`Scraping: ${url}`);

    // Navigate and wait for network to be mostly idle
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for the page to settle
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get the page content for debugging
    const pageContent = await page.content();
    const hasPrice = pageContent.includes('$') || pageContent.includes('price');
    console.log(`  Page has price indicators: ${hasPrice}`);
    console.log(`  Page length: ${pageContent.length} chars`);

    const data = await page.evaluate(() => {
      const debugInfo = [];

      // Costco.ca specific selectors
      const priceSelectors = [
        '.your-price .value',
        '.your-price',
        '#pull-right-price .value',
        '#pull-right-price',
        '.price-value',
        '.sale-price',
        '.promo-price',
        '.current-price',
        '.final-price',
        '.product-price',
        '.price .value',
        '.price-sales',
        '.offer-price',
        '[class*="price"]',
      ];

      let priceText = null;
      let usedSelector = null;

      for (const selector of priceSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent.trim();
            if (text && /\$[\d,]+\.\d{2}/.test(text)) {
              debugInfo.push(`${selector}: "${text.substring(0, 50)}"`);
              if (!priceText) {
                priceText = text;
                usedSelector = selector;
              }
            }
          }
        } catch (e) {
          // Continue
        }
      }

      // Fallback: scan all text nodes for price pattern
      if (!priceText) {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent.trim();
          const match = text.match(/\$[\d,]+\.\d{2}/);
          if (match) {
            debugInfo.push(`TextNode: "${text.substring(0, 50)}"`);
            if (!priceText) {
              priceText = match[0];
              usedSelector = 'text-node-scan';
            }
          }
        }
      }

      // Get title
      let title = null;
      const h1 = document.querySelector('h1');
      if (h1) {
        title = h1.textContent.trim();
      }

      return {
        priceText,
        title,
        usedSelector,
        debug: debugInfo.slice(0, 15),
        bodyText: document.body.innerText.substring(0, 500)
      };
    });

    console.log(`  Title: ${data.title || 'not found'}`);
    console.log(`  Price text: ${data.priceText || 'not found'}`);
    console.log(`  Used selector: ${data.usedSelector || 'none'}`);
    if (data.debug && data.debug.length > 0) {
      console.log(`  Debug selectors found: ${data.debug.length}`);
      data.debug.forEach(d => console.log(`    - ${d}`));
    }
    if (!data.priceText) {
      console.log(`  Body preview: ${data.bodyText.substring(0, 200)}...`);
    }

    if (!data.priceText) {
      throw new Error('Price not found on page');
    }

    // Parse price
    const priceMatch = data.priceText.match(/[\d,]+\.\d{2}/);
    if (!priceMatch) {
      throw new Error(`Could not parse price from: ${data.priceText}`);
    }

    const price = parseFloat(priceMatch[0].replace(',', ''));

    return {
      url,
      title: data.title,
      price,
      success: true,
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return {
      url,
      success: false,
      error: error.message,
    };
  }
}

async function updatePrices(updates) {
  const successfulUpdates = updates.filter(u => u.success);

  if (successfulUpdates.length === 0) {
    console.log('No successful scrapes to update');
    return;
  }

  const response = await fetch(`${API_URL}/api/update-prices`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UPDATE_PRICES_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      updates: successfulUpdates.map(u => ({
        url: u.url,
        title: u.title,
        price: u.price,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update prices: ${response.status}`);
  }

  const result = await response.json();
  console.log('Update result:', JSON.stringify(result, null, 2));
}

async function main() {
  if (!API_URL || !UPDATE_PRICES_SECRET) {
    console.error('Missing required environment variables: API_URL, UPDATE_PRICES_SECRET');
    process.exit(1);
  }

  console.log('Starting price scraper...');
  console.log(`API URL: ${API_URL}`);

  const products = await fetchProductUrls();
  console.log(`Found ${products.length} products to scrape`);

  if (products.length === 0) {
    console.log('No products to scrape');
    return;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();

  // Make it look less like a bot
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.setViewport({ width: 1920, height: 1080 });

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-CA,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  });

  const results = [];

  for (const product of products) {
    const result = await scrapeCostcoProduct(page, product.url);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  await browser.close();

  console.log('\n--- Scrape Results ---');
  results.forEach(r => {
    if (r.success) {
      console.log(`OK: ${r.url} - $${r.price}`);
    } else {
      console.log(`FAIL: ${r.url} - ${r.error}`);
    }
  });

  await updatePrices(results);

  const successCount = results.filter(r => r.success).length;
  console.log(`\nCompleted: ${successCount}/${results.length} successful`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
