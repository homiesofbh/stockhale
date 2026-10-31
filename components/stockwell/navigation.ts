import {
  Boxes,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  CalendarCheck,
  FileText,
  LayoutDashboard,
  Package,
  Store as StoreIcon,
  TrendingUp,
  Truck,
  Undo2,
  Users,
  Wallet,
  Factory,
} from "lucide-react";
export type Module =
  | "Dashboard"
  | "Inventory"
  | "Purchases"
  | "Billing"
  | "Sales"
  | "Accounts Heads"
  | "Expenses"
  | "Payments"
  | "Suppliers"
  | "Customers"
  | "Returns & Damage"
  | "Reports"
  | "Closing"
  | "Production"
  | "Settings"
  | "Notifications";
export const nav: {
  name: Module;
  icon: typeof Package;
}[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Inventory", icon: Boxes },
  { name: "Purchases", icon: Truck },
  { name: "Billing", icon: FileText },
  { name: "Sales", icon: TrendingUp },
  { name: "Accounts Heads", icon: ClipboardList },
  { name: "Expenses", icon: Wallet },
  { name: "Payments", icon: CreditCard },
  { name: "Suppliers", icon: StoreIcon },
  { name: "Customers", icon: Users },
  { name: "Returns & Damage", icon: Undo2 },
  { name: "Reports", icon: CircleDollarSign },
  { name: "Closing", icon: CalendarCheck },
  { name: "Production", icon: Factory },
];
export const descriptions: Record<Module, string> = {
  Settings: "Manage your business profile and team.",
  Notifications: "Admin notifications and activity history.",
  Dashboard: "A clear view of your inventory, production, and sales.",
  Inventory: "Every item, every movement. Keep your stock in balance.",
  Purchases: "Record incoming goods and manage supplier purchases.",
  Billing: "Build a bill, collect payment, and keep the queue moving.",
  Sales: "Your sales records, with the detail behind every number.",
  "Accounts Heads": "Organize your financial transactions by account head.",
  Expenses: "Track the everyday costs of running your business.",
  Payments: "Collect customer balances and settle supplier payments.",
  Suppliers: "Your suppliers, purchases, and outstanding balances.",
  Customers: "Customer details, billing history, and balances in one place.",
  "Returns & Damage": "Record returns and damage with a clear stock trail.",
  Reports: "Turn your daily records into a clearer business picture.",
  Closing: "Reconcile the cash drawer and close each business day safely.",
  Production: "Turn ingredient stock into finished goods with recipes and batch records.",
};
