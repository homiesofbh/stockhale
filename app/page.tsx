'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  Package,
  Plus,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Tags,
  TrendingUp,
  Wallet,
  X,
  Building2,
  UserPlus,
  ShieldCheck,
  Truck,
  Percent,
  Palette,
  Image as ImageIcon,
  Upload,
  Check,
  HelpCircle,
} from 'lucide-react'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Sales', icon: ShoppingCart },
  { label: 'Purchases', icon: Package },
  { label: 'Expenses', icon: Receipt },
  { label: 'Ledger', icon: FileText },
  { label: 'Reports', icon: BarChart3 },
]

const transactions = [
  { type: 'sale', title: 'Sale #1048', detail: 'Ayesha Textiles', date: 'Today, 10:42 AM', amount: '+$1,240.00', status: 'Paid' },
  { type: 'purchase', title: 'Purchase #0821', detail: 'Metro Fabric Mills', date: 'Today, 9:15 AM', amount: '-$860.00', status: 'Due in 14 days' },
  { type: 'expense', title: 'Electricity bill', detail: 'Utilities', date: 'Yesterday, 4:30 PM', amount: '-$184.20', status: 'Paid' },
  { type: 'sale', title: 'Sale #1047', detail: 'Hassan & Sons', date: 'Yesterday, 1:08 PM', amount: '+$720.00', status: 'Partial' },
]

function StatCard({ label, value, change, icon: Icon, tone }: { label: string; value: string; change: string; icon: typeof Wallet; tone: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={18} strokeWidth={2.2} /></div>
      <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={change.startsWith('-') ? 'negative' : ''}>{change}</small></div>
    </div>
  )
}

export default function Page() {
  const [active, setActive] = useState('Overview')
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('Sale')
  const [search, setSearch] = useState('')
  const [customerType, setCustomerType] = useState('Walk-in customer')
  const [paymentType, setPaymentType] = useState('Fully paid')
  const [paymentMode, setPaymentMode] = useState('Fixed amount')
  const [showCustomerFields, setShowCustomerFields] = useState(false)
  const [showPolicyPanel, setShowPolicyPanel] = useState(false)
  const [showCustomization, setShowCustomization] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [themeColor, setThemeColor] = useState('green')
  const [backgroundColor, setBackgroundColor] = useState('#f7f8f6')
  const [profileImage, setProfileImage] = useState('')
  const [products, setProducts] = useState(['Premium Cotton', 'Classic Linen'])
  const [vendors, setVendors] = useState(['Metro Fabric Mills'])
  const [purchaseProduct, setPurchaseProduct] = useState('')
  const [purchaseVendor, setPurchaseVendor] = useState('')
  const [purchaseQuantity, setPurchaseQuantity] = useState('')
  const [purchaseHsCode, setPurchaseHsCode] = useState('')
  const [purchaseUom, setPurchaseUom] = useState('')
  const [addingNewProduct, setAddingNewProduct] = useState(false)
  const [addingNewVendor, setAddingNewVendor] = useState(false)
  const filtered = useMemo(() => transactions.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(search.toLowerCase())), [search])

  function removeProduct(name: string) { setProducts((items) => items.filter((item) => item !== name)) }
  function removeVendor(name: string) { setVendors((items) => items.filter((item) => item !== name)) }
  function renameProduct(oldName: string) { const nextName = window.prompt('New product name', oldName)?.trim(); if (nextName && nextName !== oldName) setProducts((items) => items.map((item) => item === oldName ? nextName : item)) }
  function renameVendor(oldName: string) { const nextName = window.prompt('New vendor name', oldName)?.trim(); if (nextName && nextName !== oldName) setVendors((items) => items.map((item) => item === oldName ? nextName : item)) }

  function openForm(type: string) { setFormType(type); setShowForm(true); setShowCustomerFields(false); setPaymentType('Fully paid') }

  return (
    <div className={`app-shell theme-${themeColor}`} style={{ '--background': backgroundColor } as CSSProperties}>
      <input id="profile-upload" className="sr-only" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setProfileImage(URL.createObjectURL(file)) }} />
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={17} /></div><span>Ledgerly</span></div>
        <div className="business-switcher"><div className="business-avatar">AT</div><div><strong>Al Noor Textiles</strong><span>Owner account</span></div><ChevronDown size={15} /></div>
        <nav aria-label="Main navigation"><p className="nav-label">Workspace</p>{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => setActive(label)}><Icon size={18} /><span>{label}</span>{label === 'Sales' && <b>3</b>}</button>)}</nav>
        <div className="sidebar-bottom"><button className="nav-item" onClick={() => setActive('Products')}><Tags size={18} /><span>Products & services</span></button><button className="nav-item" onClick={() => setShowPolicyPanel(true)}><Settings size={18} /><span>Settings & team access</span></button><button className="help-card" onClick={() => setShowHelp(true)}><CircleHelp size={18} /><div><strong>Need a hand?</strong><span>Visit our help center</span></div></button><div className="profile-wrap"><button className="profile" onClick={() => setShowProfileMenu((value) => !value)} aria-expanded={showProfileMenu} aria-haspopup="menu">{profileImage ? <img className="profile-avatar profile-image" src={profileImage} alt="Ahmed Khan" /> : <div className="profile-avatar">AK</div>}<div><strong>Ahmed Khan</strong><span>Free plan</span></div><MoreDots /></button>{showProfileMenu && <div className="profile-menu" role="menu"><button role="menuitem" onClick={() => { setShowProfileMenu(false); setShowCustomization(true) }}><Settings size={15} /> Settings</button><button role="menuitem" onClick={() => { setShowProfileMenu(false); setShowCustomization(true) }}><Palette size={15} /> Customize appearance</button></div>}</div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="mobile-brand"><div className="brand-mark"><Sparkles size={16} /></div>Ledgerly</div><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{active}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button><div className="top-avatar">AK</div></div></header>
        <div className="content-wrap">
          <section className="page-heading"><div><p className="eyebrow">Tuesday, October 7, 2025</p><h1>{active === 'Overview' ? 'Good morning, Ahmed' : active}</h1><p className="subheading">Here&apos;s what&apos;s happening with your business today.</p></div><button className="primary-button" onClick={() => openForm('Sale')}><Plus size={17} /> Add transaction</button></section>
          {active === 'Overview' ? <>
            <section className="stats-grid"><StatCard label="Total sales" value="$24,680.00" change="+12.8% from last month" icon={TrendingUp} tone="green" /><StatCard label="Total purchases" value="$15,240.50" change="+4.2% from last month" icon={ArrowDownLeft} tone="blue" /><StatCard label="Total expenses" value="$4,182.20" change="-2.4% from last month" icon={Wallet} tone="orange" /><StatCard label="Net profit" value="$5,257.30" change="+18.6% from last month" icon={ArrowUpRight} tone="purple" /></section>
            <section className="overview-grid"><div className="panel chart-panel"><div className="panel-heading"><div><h2>Cash flow</h2><p>Income and outgoings over the last 6 months</p></div><button className="select-button">Last 6 months <ChevronDown size={15} /></button></div><div className="chart-legend"><span><i className="legend-income" />Income</span><span><i className="legend-outcome" />Outgoings</span></div><div className="chart"><div className="chart-y"><span>$30k</span><span>$20k</span><span>$10k</span><span>$0</span></div><div className="chart-area"><div className="grid-line"/><div className="grid-line"/><div className="grid-line"/><div className="grid-line"/><svg viewBox="0 0 620 170" preserveAspectRatio="none" aria-label="Cash flow chart"><path className="area-income" d="M0 135 C45 125 70 108 110 116 S165 92 210 99 S270 65 315 82 S375 50 420 64 S480 28 520 45 S580 34 620 20 V170 H0Z"/><path className="line-income" d="M0 135 C45 125 70 108 110 116 S165 92 210 99 S270 65 315 82 S375 50 420 64 S480 28 520 45 S580 34 620 20"/><path className="line-outcome" d="M0 154 C55 145 80 152 115 139 S170 145 210 127 S270 138 315 119 S370 128 420 107 S480 119 520 98 S580 105 620 87"/></svg><div className="chart-x"><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div></div></div></div><div className="panel summary-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Keep your books up to date</p></div><SlidersHorizontal size={17} className="muted-icon" /></div><div className="quick-actions"><button onClick={() => openForm('Sale')}><span className="quick-icon green"><ShoppingCart size={18} /></span><span><strong>Record a sale</strong><small>Add a new customer sale</small></span><ArrowUpRight size={16} /></button><button onClick={() => openForm('Purchase')}><span className="quick-icon blue"><Package size={18} /></span><span><strong>Record a purchase</strong><small>Log stock from a supplier</small></span><ArrowUpRight size={16} /></button><button onClick={() => openForm('Expense')}><span className="quick-icon orange"><Receipt size={18} /></span><span><strong>Add an expense</strong><small>Track a business expense</small></span><ArrowUpRight size={16} /></button></div><div className="tip"><Sparkles size={16} /><span><strong>Nice work!</strong><br />You&apos;re 18% more profitable than last month.</span></div></div></section>
          </> : active === 'Products' ? <section className="inventory-grid"><div className="panel inventory-panel"><div className="panel-heading"><div><h2>Products</h2><p>Edit or remove products available for purchases.</p></div><button className="primary-button" onClick={() => openForm('Purchase')}><Plus size={17} /> Add product</button></div><div className="inventory-list">{products.map((product) => <div className="inventory-row" key={product}><div className="inventory-item-icon"><Package size={17} /></div><div><strong>{product}</strong><span>Available in purchase dropdown</span></div><div className="inventory-actions"><button className="text-button" onClick={() => renameProduct(product)}>Edit</button><button className="danger-button" onClick={() => removeProduct(product)}>Delete</button></div></div>)}</div></div><div className="panel inventory-panel"><div className="panel-heading"><div><h2>Vendors</h2><p>Keep your supplier list clean and current.</p></div></div><div className="inventory-list">{vendors.map((vendor) => <div className="inventory-row" key={vendor}><div className="inventory-item-icon vendor"><Truck size={17} /></div><div><strong>{vendor}</strong><span>Available in purchase dropdown</span></div><div className="inventory-actions"><button className="text-button" onClick={() => renameVendor(vendor)}>Edit</button><button className="danger-button" onClick={() => removeVendor(vendor)}>Delete</button></div></div>)}</div></div></section> : <section className="panel page-placeholder"><div className="placeholder-icon"><FileText size={26} /></div><h2>{active} workspace</h2><p>Manage your {active.toLowerCase()} records in one simple place.</p><button className="primary-button" onClick={() => openForm(active === 'Purchases' ? 'Purchase' : active === 'Expenses' ? 'Expense' : 'Sale')}><Plus size={17} /> Add {active === 'Purchases' ? 'purchase' : active === 'Expenses' ? 'expense' : 'record'}</button></section>}
          <section className="panel transactions-panel"><div className="panel-heading"><div><h2>Recent transactions</h2><p>Your latest business activity</p></div><button className="text-button" onClick={() => setActive('Ledger')}>View all <ArrowUpRight size={15} /></button></div><div className="table-tools"><div className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions..." aria-label="Search transactions" /></div><button className="filter-button"><SlidersHorizontal size={15} /> Filter</button></div><div className="transaction-list">{filtered.map((item) => <div className="transaction-row" key={item.title}><div className={`transaction-icon ${item.type}`} >{item.type === 'sale' ? <ArrowUpRight size={17} /> : item.type === 'purchase' ? <ArrowDownLeft size={17} /> : <Receipt size={17} />}</div><div className="transaction-name"><strong>{item.title}</strong><span>{item.detail}</span></div><div className="transaction-date">{item.date}</div><div className="transaction-amount"><strong className={item.amount.startsWith('+') ? 'positive' : ''}>{item.amount}</strong><span className={`status ${item.status === 'Paid' ? 'paid' : item.status === 'Partial' ? 'partial' : 'due'}`}>{item.status}</span></div></div>)}</div></section>
        </div>
      </main>
      {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}><div className="modal wide-modal" onClick={(e) => e.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">{formType === 'Purchase' ? 'Stock intake' : 'New entry'}</p><h2>{formType === 'Purchase' ? 'Record a purchase' : formType === 'Sale' ? 'Record a sale' : 'Record an expense'}</h2><p className="modal-hint">Required fields are marked with an asterisk.</p></div><button className="close-button" onClick={() => setShowForm(false)} aria-label="Close"><X size={18} /></button></div>
        {formType === 'Purchase' ? <><div className="form-section"><div className="section-title"><Package size={16} /> Product and vendor details</div><div className="form-grid"><label>Product *<select value={addingNewProduct ? '__new__' : purchaseProduct} onChange={(e) => { const value = e.target.value; setAddingNewProduct(value === '__new__'); setPurchaseProduct(value === '__new__' ? '' : value) }}><option value="" disabled>Select existing product</option>{products.map((product) => <option key={product} value={product}>{product}</option>)}<option value="__new__">+ Add new product</option></select>{addingNewProduct && <input value={purchaseProduct} onChange={(e) => setPurchaseProduct(e.target.value)} placeholder="Enter new product name" autoFocus />}</label><label>Vendor *<select value={addingNewVendor ? '__new__' : purchaseVendor} onChange={(e) => { const value = e.target.value; setAddingNewVendor(value === '__new__'); setPurchaseVendor(value === '__new__' ? '' : value) }}><option value="" disabled>Select existing vendor</option>{vendors.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}<option value="__new__">+ Add new vendor</option></select>{addingNewVendor && <input value={purchaseVendor} onChange={(e) => setPurchaseVendor(e.target.value)} placeholder="Enter new vendor name" autoFocus />}</label></div><div className="form-grid"><label>Quantity *<input type="number" min="1" value={purchaseQuantity} onChange={(e) => setPurchaseQuantity(e.target.value)} placeholder="Enter quantity" /></label><label>HS code *<input value={purchaseHsCode} onChange={(e) => setPurchaseHsCode(e.target.value)} placeholder="e.g. 5208.11" /></label></div><div className="form-grid"><label>Unit of measure *<select value={purchaseUom} onChange={(e) => setPurchaseUom(e.target.value)}><option value="" disabled>Select UOM</option><option>Pieces</option><option>Meters</option><option>Kg</option><option>Boxes</option></select></label><label>Purchase amount *<input type="number" min="0" placeholder="0.00" /></label></div></div><div className="form-section"><div className="section-title"><Truck size={16} /> Purchase summary</div><p className="modal-hint">Saving this purchase will add the product to your product list and the vendor to your vendor list automatically.</p></div></> : formType === 'Sale' ? <><div className="form-section"><div className="section-title"><ShoppingCart size={16} /> Sale details</div><div className="form-grid"><label>Product *<select defaultValue=""><option value="" disabled>Select a product</option><option>Premium Cotton — 42 units</option><option>Classic Linen — 18 units</option></select></label><label>Quantity *<input type="number" min="1" placeholder="Enter quantity" /></label></div><div className="form-grid"><label>Customer type *<select value={customerType} onChange={(e) => setCustomerType(e.target.value)}><option>Walk-in customer</option><option>Company</option></select></label><label>Sale date *<input type="date" defaultValue="2025-10-07" /></label></div>{customerType === 'Company' && <div className="company-fields"><label>Company name *<input placeholder="e.g. Ayesha Textiles" /></label><div className="form-grid"><label>Phone number<input placeholder="+92 300 0000000" /></label><label>Email<input type="email" placeholder="accounts@company.com" /></label></div><label>Address<input placeholder="Business address" /></label><label>NTN / Tax number<input placeholder="Optional tax registration number" /></label></div>}</div><div className="form-section"><div className="section-title"><Wallet size={16} /> Payment</div><div className="form-grid"><label>Total amount *<input type="number" min="0" placeholder="0.00" /></label><label>Payment status *<select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}><option>Fully paid</option><option>Paid partially</option></select></label></div>{paymentType === 'Paid partially' && <div className="form-grid"><label>Payment format *<select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}><option>Fixed amount</option><option>Percentage</option></select></label><label>{paymentMode === 'Percentage' ? 'Paid percentage *' : 'Paid amount *'}<input type="number" min="0" placeholder={paymentMode === 'Percentage' ? 'e.g. 50' : '0.00'} /></label></div>}</div></> : formType === 'Purchase' ? <div className="form-section"><div className="section-title"><Package size={16} /> Product intake</div><div className="form-grid"><label>Product name *<input placeholder="e.g. Premium Cotton" /></label><label>Vendor *<div className="input-with-action"><input placeholder="Select or add vendor" /><button type="button" aria-label="Add vendor"><Plus size={15} /></button></div></label><label>Quantity *<input type="number" min="1" placeholder="Enter quantity" /></label><label>HS code *<input placeholder="e.g. 5208.39" /></label><label>Unit of measure *<select defaultValue=""><option value="" disabled>Select UOM</option><option>Meter</option><option>Piece</option><option>Kg</option></select></label><label>Purchase amount *<input type="number" min="0" placeholder="0.00" /></label></div><label>Notes<input placeholder="Add a note (optional)" /></label></div> : <><label>Expense category *<input placeholder="e.g. Utilities" /></label><div className="form-grid"><label>Date<input type="date" defaultValue="2025-10-07" /></label><label>Amount *<input type="number" placeholder="0.00" /></label></div><label>Notes<textarea placeholder="Add a note (optional)" /></label></>}
        <div className="modal-actions"><button className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" onClick={() => { if (formType === 'Purchase' && purchaseProduct.trim() && purchaseVendor.trim() && purchaseQuantity && purchaseHsCode.trim() && purchaseUom) { setProducts((items) => items.includes(purchaseProduct.trim()) ? items : [...items, purchaseProduct.trim()]); setVendors((items) => items.includes(purchaseVendor.trim()) ? items : [...items, purchaseVendor.trim()]); } setShowForm(false); setPurchaseProduct(''); setPurchaseVendor(''); setPurchaseQuantity(''); setPurchaseHsCode(''); setPurchaseUom('') }}>Save {formType.toLowerCase()}</button></div></div></div>}
      {showPolicyPanel && <div className="modal-backdrop" onClick={() => setShowPolicyPanel(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">Workspace administration</p><h2>Manage team access</h2></div><button className="close-button" onClick={() => setShowPolicyPanel(false)} aria-label="Close"><X size={18} /></button></div><div className="admin-callout"><ShieldCheck size={19} /><span>Only Workspace Admins can invite sub-admins and change module policies.</span></div><button className="customize-link" onClick={() => { setShowPolicyPanel(false); setShowCustomization(true) }}><Palette size={15} /> Customize workspace appearance</button><label>Sub-admin name *<input placeholder="e.g. Sara Malik" /></label><label>Email address *<input type="email" placeholder="sara@company.com" /></label><div className="permissions-list"><div className="section-title"><UserPlus size={16} /> Module access</div>{[
                { name: 'Sales', icon: ShoppingCart },
                { name: 'Purchases', icon: Package },
                { name: 'Expenses', icon: Receipt },
                { name: 'Ledger', icon: FileText },
                { name: 'Reports', icon: BarChart3 },
              ].map(({ name, icon: Icon }) => <label className="permission-row" key={name}><span className="permission-main"><span className="permission-icon"><Icon size={15} /></span><span><strong>{name}</strong><small>Allow access to {name.toLowerCase()} module</small></span></span><input type="checkbox" defaultChecked={name !== 'Reports'} /></label>)}</div><div className="modal-actions"><button className="secondary-button" onClick={() => setShowPolicyPanel(false)}>Cancel</button><button className="primary-button" onClick={() => setShowPolicyPanel(false)}>Invite sub-admin</button></div></div></div>}
      {showCustomization && <div className="modal-backdrop" onClick={() => setShowCustomization(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">Workspace settings</p><h2>Customize your workspace</h2><p className="modal-hint">Make Ledgerly feel like your brand.</p></div><button className="close-button" onClick={() => setShowCustomization(false)} aria-label="Close"><X size={18} /></button></div><div className="customize-section"><div className="section-title"><Palette size={16} /> Color scheme</div><div className="theme-options">{[{id:'green',label:'Sage'},{id:'blue',label:'Ocean'},{id:'purple',label:'Plum'},{id:'orange',label:'Amber'}].map((theme) => <button key={theme.id} className={`theme-swatch ${theme.id} ${themeColor === theme.id ? 'selected' : ''}`} onClick={() => setThemeColor(theme.id)}><span />{theme.label}{themeColor === theme.id && <Check size={14} />}</button>)}</div><label className="background-picker">Page background<input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} /><span>{backgroundColor}</span></label></div><div className="customize-section"><div className="section-title"><ImageIcon size={16} /> Profile image</div><div className="profile-picker">{profileImage ? <img src={profileImage} alt="Profile preview" /> : <div className="profile-avatar">AK</div>}<label className="secondary-button" htmlFor="profile-upload"><Upload size={15} /> Upload image</label><button className="secondary-button" onClick={() => setProfileImage('')}>Use initials</button></div></div><div className="modal-actions"><button className="primary-button" onClick={() => setShowCustomization(false)}>Save changes</button></div></div></div>}
      {showHelp && <div className="modal-backdrop" onClick={() => setShowHelp(false)}><div className="modal help-modal" onClick={(e) => e.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">Ledgerly guide</p><h2>Help center</h2><p className="modal-hint">Learn the essentials for keeping your workspace accurate.</p></div><button className="close-button" onClick={() => setShowHelp(false)} aria-label="Close"><X size={18} /></button></div><img className="help-hero" src="/help-ledger-guide.png" alt="Business owner reviewing bookkeeping records" /><div className="help-topics"><article><ShoppingCart size={17} /><div><strong>Sales</strong><p>Record a sale by choosing a product, quantity, customer type and payment status. Company customers can include contact and tax details.</p></div></article><article><Package size={17} /><div><strong>Purchases and products</strong><p>Add products with a vendor, quantity, HS code and unit of measure before recording stock purchases.</p></div></article><article><ShieldCheck size={17} /><div><strong>Team access</strong><p>Workspace Admins can invite sub-admins and choose which modules each person can access.</p></div></article><article><BarChart3 size={17} /><div><strong>Reports</strong><p>Use the dashboard overview and reports to follow cash flow, sales, expenses and profit.</p></div></article></div><div className="modal-actions"><button className="primary-button" onClick={() => setShowHelp(false)}>Got it</button></div></div></div>}
    </div>
  )
}

function MoreDots() { return <span className="more-dots" aria-label="More options"><i /><i /><i /></span> }
