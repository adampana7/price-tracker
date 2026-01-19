import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').notNull().unique(),
  title: text('title'),
  originalPrice: real('original_price').notNull(),
  currentPrice: real('current_price').notNull(),
  retailer: text('retailer').notNull().default('costco'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
