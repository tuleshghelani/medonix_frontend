export interface Purchase {
  // id?: number;
  productId?: number;
  productName?: string;
  categoryId?: number;
  categoryName?: string;
  quantity?: number;
  unitPrice?: number;
  // purchaseDate: string;
  // invoiceNumber?: string;
  otherExpenses?: number;
  remainingQuantity?: number;
  // totalAmount?: number;
  remarks?: string;
  batchNumber?: string;
  isQcPass?: boolean;

  id?: number;
  customerId: number;
  purchaseDate: string;
  invoiceNumber: string;
  customerName?: string;
  totalPurchaseAmount?: number;
  products: PurchaseProduct[];
  totalAmount: number;
  totalProducts: number;
  price?: number;
  taxAmount?: number;
}

export interface PurchaseSearchRequest {
  currentPage: number;
  perPageRecord: number;
  search?: string;
  categoryId?: number;
  productId?: number;
}

export interface PurchaseResponse {
  content: Purchase[];
  totalElements: number;
  totalPages: number;
}

export interface PurchaseProduct {
  productId: number;
  quantity: number;
  unitPrice: number;
  price: number;
  taxPercentage: number;
  taxAmount: number;
  batchNumber?: string;
  remarks?: string;
}