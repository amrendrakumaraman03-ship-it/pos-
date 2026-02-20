export interface Product {
  id: string;
  name: string;
  code: string; // Barcode or manual code
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  stockUnit?: string; // e.g. 'Tablet', 'Strip', 'Kg'
  gstPercent: number;
  gstIncluded?: boolean; // true = Tax included in sellingPrice, false = Tax added on top
}

export interface CartItem extends Product {
  qty: number;
  discount: number; // in currency
}

export enum PaymentMode {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  UPI = 'UPI',
  MIXED = 'MIXED'
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  address?: string;
  gst?: string;
}

export interface Bill {
  id: string;
  date: string; // ISO string
  timestamp: number;
  items: CartItem[];
  subtotal: number;
  totalGst: number;
  totalDiscount: number;
  grandTotal: number;
  paymentMode: PaymentMode;
  customerId?: string; // Required if credit
  cashAmount?: number; // For mixed
  upiAmount?: number; // For mixed
  status: 'PAID' | 'CREDIT' | 'PARTIAL' | 'CANCELLED';
}

export interface LedgerEntry {
  date: string; // YYYY-MM-DD
  openingBalance: number;
  
  // Breakdown for "Gross - Deductions" logic
  grossSales: number;       // Total value of items sold
  onlineSales: number;      // Deduction: UPI/Wallet
  creditSales: number;      // Deduction: Credit given
  expenses: number;         // Deduction: Others/Expenses
  
  // Totals
  expectedCash: number;     // (Opening + Gross) - (Online + Credit + Expenses)
  actualCash: number;       // Counted by user
  depositedToBank: number;  // Cash sent to bank
  closingBalance: number;   // actualCash - depositedToBank (Carried forward)
  
  difference: number;       // closingBalance - expectedCash (Technically calculation differs slightly based on view, but usually Actual - Expected)
  
  isClosed: boolean;
  isAutoMode: boolean;      // To track if it was closed using Auto fetch or Manual
  notes?: string;
}

export interface KhataEntry {
  id: string;
  billId?: string;
  customerId: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT'; // Debit = Customer owes us, Credit = Customer paid us
  date: string;
  description: string;
}