// Model podataka iz API-CONTRACT.md §2. Frontend poznaje samo ove tipove.
import type { Delivery } from './shipping';

export type Money = { amount: number; currency: 'EUR' }; // amount u centima, cijeli broj ≥ 0

export type ProductType = 'bijeli' | 'zeleni' | 'oolong' | 'crni' | 'puer' | 'aroma' | 'biljni' | 'pribor';

export type StockStatus = 'instock' | 'low' | 'outofstock' | 'backorder';

export type Stock = {
  status: StockStatus;
  quantity: number | null; // null = backend ne otkriva broj
  maxPerOrder: number;
};

export type ProductImage = { src: string; alt: string; width: number; height: number };

export type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  type: ProductType;
  unitLabel: string;
  price: Money;
  taxIncluded: true;
  descriptionHtml: string; // SIROV HTML iz backenda; sanitizira se pri buildu
  images: ProductImage[];
  attributes: {
    origin?: string;
    caffeine?: 0 | 1 | 2 | 3;
    flavors: string[];
    form?: 'rastresiti' | 'kolac' | 'prah' | 'pribor';
    moods: string[];
    badges: ('bio' | 'rijetko' | 'novo')[];
    brew?: { temp: string; time: string; dose: string };
  };
  stock: Stock;
  published: boolean;
  updatedAt: string;
};

export type ProductTypeInfo = { key: ProductType; name: string; description: string };

export type LiveInfo = { sku: string; price: Money; stock: Stock; available: boolean };

export type CartLine = { sku: string; qty: number };

export type CartCheckFailReason = 'UNKNOWN_SKU' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'UNPUBLISHED';

export type CartCheckLine =
  | { sku: string; qty: number; ok: true; unitPrice: Money; lineTotal: Money; stock: Stock }
  | { sku: string; qty: number; ok: false; reason: CartCheckFailReason; availableQty: number | null; unitPrice?: Money };

export type CartCheck = {
  lines: CartCheckLine[];
  subtotal: Money; // samo zbroj redaka koji su ok
  priceChanged: boolean;
  checkedAt: string;
};

export type CheckoutStart = { redirectUrl: string; orderToken: string };

export type OrderStatus = {
  status: 'paid' | 'pending' | 'failed' | 'cancelled' | 'unknown';
  orderRef?: string;
  email?: string;
};

export interface ShopBackend {
  // BUILD (ne zovu se u pregledniku)
  listProducts(): Promise<Product[]>;
  listTypes(): Promise<ProductTypeInfo[]>;
  // KLIJENT
  getLive(skus: string[]): Promise<LiveInfo[]>;
  checkCart(lines: CartLine[]): Promise<CartCheck>;
  startCheckout(lines: CartLine[], urls: { success: string; cancel: string }, delivery?: Delivery): Promise<CheckoutStart>;
  getOrderStatus(orderToken: string): Promise<OrderStatus>;
}

export const PRODUCT_TYPES: readonly ProductType[] = ['bijeli', 'zeleni', 'oolong', 'crni', 'puer', 'aroma', 'biljni', 'pribor'];

export const LIMITS = { maxSkusPerLive: 50, maxCartLines: 50 } as const;
