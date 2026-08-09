# Share Cafe — Management System

A cloud-based management system built for **Share Cafe** (Al Saada, Salalah, Oman) — everything needed to run the cafe day to day, in one place: sales, inventory, staff, customers, and reporting. Available in **English and Arabic**, with full right-to-left support.

## Features

### Secure, role-based access
- Three roles with different levels of access — **Admin**, **Manager**, **Staff** — each sees only the tools relevant to their job.
- **Single-device login** — signing in on a new device instantly ends the session on the old one.
- **IP-based login restriction** — an Admin can whitelist or blacklist which locations are allowed to log in.
- Full **activity log** of every login, logout, and forced session expiry, with device and IP info.

### Point of Sale
- Fast checkout: browse the live menu, build an order, adjust quantities, charge.
- Supports **Dine-in, Takeaway, Delivery, and Talabat** order types.
- **Split payments** across Cash, Card, and Wallet.
- Automatic **5% Oman VAT** calculation on every sale.
- **"Taken by" attribution** — record which staff member actually served an order, independent of who's logged into the till.
- Live **order status board** (New → Preparing → Ready → Served) so the kitchen and front of house stay in sync.
- Order cancellation, with printable **thermal receipts**.
- Click any past order (from the Dashboard or Order Management) to pull up its real payment receipt — items, totals, payment method(s), and the linked invoice PDF.
- Menu categories can be created on the fly right from the "Add menu item" form.

### Inventory
- Track ingredient stock levels, reorder thresholds, and expiry dates.
- One-click restock plus a full purchase / sale / wastage / adjustment history for every ingredient.
- Stock is **deducted automatically** when a menu item is sold, based on its recipe.
- Automatic **low-stock and expiry alerts**.
- Menu management — add and edit dishes, pricing, and categories.

### Invoicing
- Invoices generate automatically from completed orders and download as PDF.
- Refunds and cancellations are tracked against each invoice.

### HR & Payroll
- Employee profiles, with an Admin/Manager view of attendance, leave, and payroll for the whole team.
- **Self-service portal for Staff** — check in/out for the day, view personal sales performance, download their own payslips, and submit leave requests, without seeing anyone else's data.
- **Attendance approval workflow** — a Staff check-in lands as *pending* until a Manager or Admin accepts it; only approved attendance counts toward attendance-rate stats, so the numbers on the dashboard are always something a manager actually signed off on.
- **Payslip generation** with overtime automatically calculated from attendance records, exported as a branded PDF.
- Admins can see each employee's last login location for security oversight.

### Customers (CRM)
- Customer database with **loyalty points** earned automatically on every payment.
- Customer feedback and complete purchase history per customer.

### Dashboard & Reports
- Daily, weekly, monthly, and yearly sales reports.
- Best-selling items, peak hours, and revenue & profit breakdowns.
- **Employee performance leaderboard** — orders served and revenue generated, real employees only.
- Expense tracking and VAT-collected reporting for filing.

### Notifications
- A live notification bell for low stock, expiring ingredients, and other important events.
- Admins are automatically notified whenever a Manager deletes something from inventory.

### Multi-language
- Switch between **English** and **Arabic** from any screen, including the login page — the choice is remembered for next time.
- Arabic runs fully right-to-left: navigation, tables, charts, and forms all mirror correctly, not just the text.

### Help & Support
- A dedicated in-app page with the support team's contact details and a one-tap WhatsApp link.

## Who can do what

| | Admin | Manager | Staff |
|---|:---:|:---:|:---:|
| Sales & POS | ✅ | ✅ | — |
| Cancel orders | ✅ | ❌ | — |
| Inventory | ✅ | ✅ | — |
| Add/edit menu items | ✅ | — | — |
| Dashboard | ✅ | View only | — |
| Accounting | ✅ | View only | — |
| Reports | ✅ | — | — |
| HR & Payroll (team-wide) | ✅ | ✅ * | — |
| HR & Payroll (self-service) | — | — | ✅ |

\* A Manager can manage Staff-level HR records, but never another Manager's or an Admin's.
