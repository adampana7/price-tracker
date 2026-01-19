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

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait longer for dynamic content to load
    await page.waitForFunction(() => {
      // Wait until we find some price-like content on the page
      const bodyText = document.body.innerText;
      return bodyText.includes('$') || bodyText.includes('CAD');
    }, { timeout: 15000 });

    // Additional wait for JavaScript rendering
    await new Promise(resolve => setTimeout(resolve, 3000));

    const data = await page.evaluate(() => {
      // Debug: log what we find
      const debugInfo = [];

      // Costco.ca specific selectors - try multiple patterns
      const priceSelectors = [
        // Costco specific
        '.your-price .value',
        '.your-price',
        '#pull-right-price .value',
        '#pull-right-price',
        '.price-value',
        '.sale-price',
        '.promo-price',
        '[data-testid="price"]',
        // Common e-commerce patterns
        '.current-price',
        '.final-price',
        '.product-price',
        '.price .value',
        '.price-sales',
        '.offer-price',
        // Generic fallbacks
        '[class*="sale"][class*="price"]',
        '[class*="your"][class*="price"]',
        '[class*="final"][class*="price"]',
        '[class*="current"][class*="price"]',
      ];

      let priceText = null;
      let usedSelector = null;

      for (const selector of priceSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            const text = el.textContent.trim();
            debugInfo.push(`${selector}: "${text}"`);
            if (text && text.includes('$')) {
              priceText = text;
              usedSelector = selector;
              break;
            }
          }
        } catch (e) {
          // Selector might be invalid, continue
        }
      }

      // If still no price, try to find any element with a price pattern
      if (!priceText) {
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          if (el.children.length === 0) { // leaf nodes only
            const text = el.textContent.trim();
            // Look for Canadian dollar format: $1,234.56
            if (/^\$[\d,]+\.\d{2}$/.test(text)) {
              const price = parseFloat(text.replace(/[$,]/g, ''));
              // Reasonable price range for Costco products
              if (price > 0 && price < 100000) {
                debugInfo.push(`Found price in leaf node: "${text}"`);
                if (!priceText) {
                  priceText = text;
                  usedSelector = 'leaf-node-scan';
                }
              }
            }
          }
        }
      }

      // Get title
      const titleSelectors = ['h1', '.product-title', '.product-name', '[data-testid="product-title"]'];
      let title = null;
      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          title = el.textContent.trim();
          break;
        }
      }

      return {
        priceText,
        title,
        usedSelector,
        debug: debugInfo.slice(0, 10) // Limit debug output
      };
    });

    console.log(`  Title: ${data.title || 'not found'}`);
    console.log(`  Price text: ${data.priceText || 'not found'}`);
    console.log(`  Used selector: ${data.usedSelector || 'none'}`);
    if (data.debug && data.debug.length > 0) {
      console.log(`  Debug: ${data.debug.join(', ')}`);
    }

    if (!data.priceText) {
      // Take a screenshot for debugging
      await page.screenshot({ path: '/tmp/debug-screenshot.png', fullPage: false });
      throw new Error('Price not found on page');
    }

    // Parse price from text like "$1,399.99" or "1,399.99"
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
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Set a realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-CA,en;q=0.9',
  });

  const results = [];

  for (const product of products) {
    const result = await scrapeCostcoProduct(page, product.url);
    results.push(result);

    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
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
