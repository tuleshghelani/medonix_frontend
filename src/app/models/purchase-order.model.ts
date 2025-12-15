export interface PurchaseOrder {
  id?: number;
  customerId: number;
  orderDate: string;
  invoiceNumber: string;
  customerName?: string;
  totalOrderAmount?: number;
  products: PurchaseOrderItem[];
  totalAmount: number;
  totalProducts: number;
  price?: number;
  taxAmount?: number;
  packagingAndForwadingCharges?: number;
}

export interface PurchaseOrderSearchRequest {
  currentPage: number;
  perPageRecord: number;
  search?: string;
  customerId?: number;
  startDate?: string;
  endDate?: string;
  batchNumber?: string;
}

export interface PurchaseOrderResponse {
  content: PurchaseOrder[];
  totalElements: number;
  totalPages: number;
}

export interface PurchaseOrderItem {
  id?: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  batchNumber?: string;
  remarks?: string;
}

