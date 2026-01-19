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

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for price to load
    await page.waitForSelector('[data-automation="finalPrice"], .price, .product-price', { timeout: 10000 });

    const data = await page.evaluate(() => {
      // Try multiple selectors for price
      const priceSelectors = [
        '[data-automation="finalPrice"]',
        '.price',
        '.product-price',
        '[class*="price"]',
        '[data-testid="product-price"]',
      ];

      let priceText = null;
      for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          priceText = el.textContent;
          break;
        }
      }

      // Try multiple selectors for title
      const titleSelectors = [
        'h1',
        '.product-title',
        '[data-automation="productName"]',
        '.product-name',
      ];

      let title = null;
      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          title = el.textContent.trim();
          break;
        }
      }

      return { priceText, title };
    });

    if (!data.priceText) {
      throw new Error('Price not found on page');
    }

    // Parse price from text like "$19.99" or "19,99 $"
    const priceMatch = data.priceText.match(/[\d,]+\.?\d*/);
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
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Set a realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  const results = [];

  for (const product of products) {
    const result = await scrapeCostcoProduct(page, product.url);
    results.push(result);

    // Add a small delay between requests to be polite
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
