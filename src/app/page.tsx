'use client';

import { useState, useEffect, useCallback } from 'react';
import ProductTable from '@/components/ProductTable';
import AddProductForm from '@/components/AddProductForm';
import { Product } from '@/lib/schema';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const response = await fetch(`/api/products?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      fetchProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete product');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Price Tracker</h1>
          <p className="text-gray-600 mt-2">
            Track product prices from Costco.ca. Significant price changes (&gt;2%) are highlighted.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <AddProductForm onProductAdded={fetchProducts} />
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  Loading products...
                </div>
              ) : error ? (
                <div className="p-8 text-center text-red-600">
                  {error}
                </div>
              ) : (
                <ProductTable products={products} onDelete={handleDelete} />
              )}
            </div>
          </div>
        </div>

        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>
            Prices are updated daily via GitHub Actions.
            <br />
            <span className="text-green-600 font-medium">Green</span> = price decreased,{' '}
            <span className="text-red-600 font-medium">Red</span> = price increased
          </p>
        </footer>
      </div>
    </div>
  );
}
