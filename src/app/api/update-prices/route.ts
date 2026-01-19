import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Verify the secret token
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.UPDATE_PRICES_SECRET;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'Updates must be an array' }, { status: 400 });
    }

    const results = [];

    for (const update of updates) {
      const { url, title, price } = update;

      if (!url || price === undefined) {
        results.push({ url, success: false, error: 'Missing url or price' });
        continue;
      }

      try {
        const result = await db
          .update(products)
          .set({
            currentPrice: price,
            title: title || undefined,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(products.url, url))
          .returning();

        if (result.length > 0) {
          results.push({ url, success: true, product: result[0] });
        } else {
          results.push({ url, success: false, error: 'Product not found' });
        }
      } catch (error) {
        results.push({ url, success: false, error: String(error) });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error updating prices:', error);
    return NextResponse.json({ error: 'Failed to update prices' }, { status: 500 });
  }
}

// GET endpoint to fetch all product URLs for the scraper
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.UPDATE_PRICES_SECRET;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allProducts = await db.select({
      url: products.url,
      id: products.id,
    }).from(products);

    return NextResponse.json(allProducts);
  } catch (error) {
    console.error('Error fetching product URLs:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
