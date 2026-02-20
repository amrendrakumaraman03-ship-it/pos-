import { Product, Bill, Customer, LedgerEntry, KhataEntry, PaymentMode } from '../types';

// Keys
const KEYS = {
  PRODUCTS: 'bharat_pos_products',
  BILLS: 'bharat_pos_bills',
  CUSTOMERS: 'bharat_pos_customers',
  LEDGER: 'bharat_pos_ledger',
  KHATA: 'bharat_pos_khata',
};

// Helpers with Safety Checks
const get = <T>(key: string, defaultVal: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    console.error(`Error reading key ${key} from localStorage`, e);
    return defaultVal;
  }
};

const set = <T>(key: string, val: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error(`Error writing key ${key} to localStorage`, e);
  }
};

// --- Products ---
export const getProducts = (): Product[] => get(KEYS.PRODUCTS, []);
export const saveProduct = (product: Product) => {
  const products = getProducts();
  const index = products.findIndex(p => p.id === product.id);
  if (index >= 0) {
    products[index] = product;
  } else {
    products.push(product);
  }
  set(KEYS.PRODUCTS, products);
};
export const deleteProduct = (id: string) => {
  const products = getProducts().filter(p => p.id !== id);
  set(KEYS.PRODUCTS, products);
};

// --- Customers ---
export const getCustomers = (): Customer[] => get(KEYS.CUSTOMERS, []);
export const saveCustomer = (customer: Customer) => {
  const customers = getCustomers();
  const index = customers.findIndex(c => c.id === customer.id);
  if (index >= 0) {
    customers[index] = customer;
  } else {
    customers.push(customer);
  }
  set(KEYS.CUSTOMERS, customers);
};

// --- Bills & Khata & Inventory Update Transaction ---
export const saveBill = (bill: Bill, customer?: Customer) => {
  // 1. Save Bill
  const bills = get(KEYS.BILLS, []);
  bills.push(bill);
  set(KEYS.BILLS, bills);

  // 2. Update Inventory
  const products = getProducts();
  bill.items.forEach(item => {
    const pIndex = products.findIndex(p => p.id === item.id);
    if (pIndex >= 0) {
      products[pIndex].stock -= item.qty;
    }
  });
  set(KEYS.PRODUCTS, products);

  // 3. Save Customer if new/updated
  if (customer) {
    saveCustomer(customer);
  }

  // 4. Update Khata if Credit
  if (bill.paymentMode === PaymentMode.CREDIT || bill.status === 'CREDIT') {
    if (!customer) throw new Error("Customer required for credit");
    const khata = get<KhataEntry[]>(KEYS.KHATA, []);
    khata.push({
      id: crypto.randomUUID(),
      billId: bill.id,
      customerId: customer.id,
      amount: bill.grandTotal,
      type: 'DEBIT', // They owe us
      date: bill.date,
      description: `Bill #${bill.id.slice(0, 8)}`
    });
    set(KEYS.KHATA, khata);
  }
};

export const getBills = (): Bill[] => get(KEYS.BILLS, []);

export const cancelBill = (billId: string) => {
  const bills = getBills();
  const billIndex = bills.findIndex(b => b.id === billId);
  if (billIndex === -1) return;

  const bill = bills[billIndex];
  if (bill.status === 'CANCELLED') return;

  // 1. Mark as cancelled
  bill.status = 'CANCELLED';
  bills[billIndex] = bill;
  set(KEYS.BILLS, bills);

  // 2. Restore Inventory
  const products = getProducts();
  bill.items.forEach(item => {
    const pIndex = products.findIndex(p => p.id === item.id);
    if (pIndex >= 0) {
      products[pIndex].stock += item.qty;
    }
  });
  set(KEYS.PRODUCTS, products);

  // 3. Reverse Khata (if applicable)
  if (bill.paymentMode === PaymentMode.CREDIT) {
    let khata = getKhata();
    // Find the debit entry associated with this bill and remove it or offset it
    // Simpler approach: Remove the entry if it exists
    khata = khata.filter(k => k.billId !== billId);
    set(KEYS.KHATA, khata);
  }
};

// --- Khata ---
export const getKhata = (): KhataEntry[] => get(KEYS.KHATA, []);

export const addKhataPayment = (customerId: string, amount: number, date: string) => {
  const khata = get<KhataEntry[]>(KEYS.KHATA, []);
  khata.push({
    id: crypto.randomUUID(),
    customerId,
    amount,
    type: 'CREDIT', // They paid us
    date,
    description: 'Payment Received'
  });
  set(KEYS.KHATA, khata);
};

// Manual Debit Entry (Giving credit without a bill)
export const addManualKhataDebit = (customer: Customer, amount: number, date: string, description: string) => {
  // 1. Save/Update Customer to ensure we have them
  saveCustomer(customer);

  // 2. Add Debit Entry
  const khata = get<KhataEntry[]>(KEYS.KHATA, []);
  khata.push({
    id: crypto.randomUUID(),
    customerId: customer.id,
    amount,
    type: 'DEBIT', // They owe us
    date, // ISO string or YYYY-MM-DD
    description
  });
  set(KEYS.KHATA, khata);
};

// --- Ledger ---
export const getLedger = (): LedgerEntry[] => get(KEYS.LEDGER, []);

// Retrieve ledger entry for a specific date (or initialize new one based on previous day)
export const getLedgerEntry = (date: string): LedgerEntry => {
  const ledger = getLedger();
  const existingEntry = ledger.find(l => l.date === date);

  if (existingEntry) return existingEntry;

  // Initialize for specific date
  // Find latest entry BEFORE this date to determine opening balance
  const sorted = ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastEntry = sorted.find(l => l.date < date);
  const openingBalance = lastEntry ? lastEntry.closingBalance : 0;

  return {
    date: date,
    openingBalance,
    grossSales: 0,
    onlineSales: 0,
    creditSales: 0,
    expenses: 0,
    expectedCash: 0, 
    actualCash: 0,
    difference: 0,
    depositedToBank: 0,
    closingBalance: 0,
    isClosed: false,
    isAutoMode: true
  };
};

export const getTodayLedger = (): LedgerEntry => {
  const today = new Date().toISOString().split('T')[0];
  return getLedgerEntry(today);
};

export const saveLedgerDay = (entry: LedgerEntry) => {
  const ledger = getLedger().filter(l => l.date !== entry.date);
  ledger.push(entry);
  set(KEYS.LEDGER, ledger);
};

// Calculate stats for a specific date
export const calculateDailyStats = (date: string) => {
  const bills = getBills().filter(b => b.date.startsWith(date) && b.status !== 'CANCELLED');
  
  let grossSales = 0;
  let onlineSales = 0;
  let creditSales = 0;
  
  bills.forEach(b => {
    grossSales += b.grandTotal;

    if (b.paymentMode === PaymentMode.UPI) {
      onlineSales += b.grandTotal;
    } else if (b.paymentMode === PaymentMode.CREDIT) {
      creditSales += b.grandTotal;
    } else if (b.paymentMode === PaymentMode.MIXED) {
      const upi = b.upiAmount || 0;
      onlineSales += upi;
    }
  });

  return { grossSales, onlineSales, creditSales };
};

// Helper to calc live cash for today (wrapper for backward compatibility)
export const calculateTodayLiveStats = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  return calculateDailyStats(todayStr);
};

// Legacy support if used elsewhere, but ideally we use the one above
export const calculateTodayLiveCash = () => {
  const stats = calculateTodayLiveStats();
  const khata = getKhata().filter(k => k.date.startsWith(new Date().toISOString().split('T')[0]) && k.type === 'CREDIT');
  const creditReceived = khata.reduce((sum, k) => sum + k.amount, 0);
  
  // Cash Sales = Gross - Online - Credit (Given)
  const cashSales = stats.grossSales - stats.onlineSales - stats.creditSales;

  return { cashSales, creditReceived };
};