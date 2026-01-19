'use client';

import { Product } from '@/lib/schema';

interface ProductTableProps {
  products: Product[];
  onDelete: (id: number) => void;
}

export default function ProductTable({ products, onDelete }: ProductTableProps) {
  const getPriceChangePercent = (original: number, current: number) => {
    if (original === 0) return 0;
    return ((current - original) / original) * 100;
  };

  const hasSignificantChange = (original: number, current: number) => {
    const change = Math.abs(getPriceChangePercent(original, current));
    return change > 2;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(price);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No products tracked yet. Add a product URL to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Original Price
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Current Price
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Change
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Updated
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {products.map((product) => {
            const isSignificant = hasSignificantChange(product.originalPrice, product.currentPrice);
            const changePercent = getPriceChangePercent(product.originalPrice, product.currentPrice);
            const isPriceDown = changePercent < 0;

            return (
              <tr
                key={product.id}
                className={isSignificant ? (isPriceDown ? 'bg-green-50' : 'bg-red-50') : ''}
              >
                <td className="px-6 py-4">
                  <div className={`${isSignificant ? 'font-bold' : ''} ${isSignificant && !isPriceDown ? 'text-red-600' : ''} ${isSignificant && isPriceDown ? 'text-green-600' : ''}`}>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {product.title || 'Unknown Product'}
                    </a>
                  </div>
                  <div className="text-xs text-gray-400 truncate max-w-xs">
                    {product.url}
                  </div>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap ${isSignificant ? 'font-bold' : ''} ${isSignificant && !isPriceDown ? 'text-red-600' : ''} ${isSignificant && isPriceDown ? 'text-green-600' : ''}`}>
                  {formatPrice(product.originalPrice)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap ${isSignificant ? 'font-bold' : ''} ${isSignificant && !isPriceDown ? 'text-red-600' : ''} ${isSignificant && isPriceDown ? 'text-green-600' : ''}`}>
                  {formatPrice(product.currentPrice)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap ${isSignificant ? 'font-bold' : ''} ${isSignificant && !isPriceDown ? 'text-red-600' : ''} ${isSignificant && isPriceDown ? 'text-green-600' : ''}`}>
                  {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(product.updatedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onDelete(product.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
