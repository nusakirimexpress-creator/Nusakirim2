export interface LinkSubmission {
  id: string;
  marketplace: 'shopee' | 'tokopedia' | 'tiktok' | 'lainnya';
  productUrl: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  quantity: number;
  notes?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  priceEstimate?: string;
  createdAt: string;
}

export interface ShippingRate {
  destination: string;
  duration: string;
  pricePerKg: string;
}
