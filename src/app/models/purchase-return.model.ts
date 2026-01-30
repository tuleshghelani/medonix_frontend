export interface PurchaseReturnItemDto {
  purchaseItemId?: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  price: number;
  discountPercentage?: number;
  discountAmount?: number;
  discountPrice?: number;
  taxPercentage: number;
  taxAmount: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  finalPrice: number;
  remarks?: string;
  batchNumber?: string;
}

export interface PurchaseReturnCreateDto {
  id?: number;
  purchaseId: number;
  customerId: number | null;
  purchaseReturnDate: string;
  invoiceNumber: string;
  packagingAndForwadingCharges: number;
  price?: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  products: PurchaseReturnItemDto[];
}
