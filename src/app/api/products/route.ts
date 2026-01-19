import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const allProducts = await db.select().from(products).orderBy(products.createdAt);
    return NextResponse.json(allProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, title, price } = body;

    if (!url || !price) {
      return NextResponse.json({ error: 'URL and price are required' }, { status: 400 });
    }

    // Check if product already exists
    const existing = await db.select().from(products).where(eq(products.url, url));
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Product already exists' }, { status: 409 });
    }

    // Insert new product
    const result = await db.insert(products).values({
      url,
      title: title || null,
      originalPrice: price,
      currentPrice: price,
      retailer: 'costco',
    }).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    await db.delete(products).where(eq(products.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
