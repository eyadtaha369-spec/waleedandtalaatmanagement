# Waleed & Talaat Fleet Ops

Create a high-end, production-ready Fleet & Transportation Operations Management Web Application for "Waleed & Talaat" (شركة وليد وطلعت لخدمات النقل والرحلات).

### 🎨 Visual Identity & Branding Guidelines:

- **Theme & Palette**: Dark, luxurious, executive aesthetic.

  - Primary Backgrounds: Deep Dark Navy Blue (`#0B132B`, `#1C2541`) inspired by the brand crest.

  - Accent Colors: Metallic Gold / Warm Gold (`#D4AF37`, `#F39C12`) for highlights, borders, primary buttons, and active tabs.

  - Secondary Accents: Muted Blue Grey (`#3A506B`) for cards and input containers.

  - Text Colors: Crisp White (`#FFFFFF`) for primary titles, Warm Light Amber/Gold for subtle highlights.

- **Typography & Direction**: 

  - Strictly **Right-to-Left (RTL)** layout layout.

  - Use modern, clean Arabic typography (e.g., Cairo, Tajawal, or IBM Plex Sans Arabic).

  - **ALL UI text, labels, headers, status badges, buttons, tooltips, placeholders, and charts MUST BE IN ARABIC.**

---

### 🏗️ Application Structure & Core Modules:

#### 1. Executive Dashboard (لوحة التحكّم)

- Top KPI Cards (with gold gradients & badges):

  - إجمالي الأتوبيسات (تعمل / بالورشة / معطلة)

  - الإيرادات والمقبوضات اليومية

  - إجمالي الطلاب/المشتركين

  - التنبيهات العاجلة (العقود والتراخيص والمخزون)

- Visual Charts (Recharts / Chart.js):

  - رسم بياني لمعدل استهلاك السولار والوقود لكل أتوبيس.

  - رسم بياني للمصروفات مقابل الإيرادات الشهرية.

- Quick Alert Center (تنبيهات الصيانة والتراخيص):

  - إشعارات التراخيص القريبة من الانتهاء.

  - إشعارات المواعيد القادمة لتغيير الزيت والصيانة.

#### 2. Fleet & Driver Management (إدارة الأسطول والسائقين)

- **الأتوبيسات (Buses)**: Interactive data table with status pills (تعمل, بالورشة, متوقفة), details modal (رقم اللوحة, السعة, الموديل, قراءة العداد, انتهاء الترخيص, التأمين, أحدث صيانة).

- **السائقون (Drivers)**: List of drivers, license details, assignment to primary/backup buses, shift status.

- **حضور السائقين (Attendance)**: Daily check-in/check-out logs with dynamic filters.

#### 3. Routes & Student Subscriptions (الخطوط والاشتراكات)

- **الخطوط (Bus Routes)**: Route details, pickup points (نقاط التجمع), departure/arrival schedules, assigned buses, capacity counter.

- **الطلاب والاشتراكات (Students)**: Subscriptions overview, payment status badges (خالص, متأخر, أقساط), view balance remaining, payment history dialog.

#### 4. Maintenance, Fuel & Warehouse (الورشة والمخزون والسولار)

- **أوامر الصيانة (Maintenance Orders)**: Kanban or List view for repair orders (رقم الأمر, العطل, قطع الغيار, التكلفة الإجمالية, الحالة: قيد التنفيذ / مكتمل).

- **المخزن (Inventory)**: Spare parts log, current stock level, minimum stock limit warning (تنبيه الحد الأدنى).

- **سجل السولار (Fuel Tracker)**: Odometer start/end readings, fuel volume (liters), total cost, and station records.

#### 5. Finance & Accounting (المالية والخزينة)

- **الخزينة والحسابات البنكية (Treasury & Banking)**: Daily opening/closing balance, deposits, withdrawals.

- **المصروفات والموردين (Expenses & Suppliers)**: Categorized expense logging (زيت, قطع غيار, إداريات) with supplier balance tracking.

- **القروض والالتزامات (Loans & Liabilities)**: Payment schedule, installment tracker (المسدد / المتبقي).

- **المرتبات (Payroll)**: Monthly salary slip breakdown (الأساسي, الإضافي, السُلف, الجزاءات, الصافي).

---

### ⚡ UX & UI Components Requirements:

- **Sidebar Navigation**: RTL sidebar with gold icon accents and collapsible items, featuring the brand title "وليد وطلعت - إدارة التشغيل والأسطول".

- **Global Search & Filter Bar**: Search by bus code (e.g., WV-001), driver name, student name, or route name.

- **Modals & Drawers**: Smooth dark glassmorphism dialogs for creating new entries (إضافة أتوبيس, أمر صيانة جديد, تسجيل دفع قسط).

- **Data Export & Print**: Include "تصدير إلى Excel" and "طباعة التقرير" buttons on tables.

Implement dummy state using React hooks / local state so every section is fully interactable and realistic.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://waleedandtalaatmanagement.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c316ba71-e870-4dfa-91b1-f58412d9cba8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
