# AI Agent Instructions for FerrePOS

## Project Overview
FerrePOS is a **React + Vite-based POS (Point of Sale) system** for hardware stores (ferreterías). It's a single-page application (SPA) using **HashRouter** for client-side routing with no backend APIs. All data persists locally via `localStorage`.

**Tech Stack:** React 18, Vite 4, Tailwind CSS 3, Radix UI components, Framer Motion, React Router DOM v6

---

## Architecture & Data Flow

### 1. **State Management: POSContext (Single Reducer Pattern)**
- **File:** `../src/contexts/POSContext.jsx` (~994 lines)
- **Pattern:** `useReducer` (not Redux) with custom hook `usePOS()`
- **Key modules in state:**
  - `cart[]` - Shopping cart items
  - `products[]` - Inventory (validated for duplicates, required fields: id, name, code, price, cost, stock)
  - `customers[]` - Customer database with credit limits and balances
  - `providers[]` - Supplier management
  - `sales[]` / `documents[]` - Transaction history
  - `cashRegister{}` - Daily cash tracking with movements log
  - `settings{}` - Tax rates, company info, document formatting, invoicing config
- **Dispatch Actions:** `ADD_TO_CART`, `REMOVE_FROM_CART`, `COMPLETE_SALE`, `UPDATE_PRODUCT`, etc.
- **Storage:** All state auto-synced to `localStorage` key `'ferrePOS_data'` on every change

### 2. **Routing Structure**
- **HashRouter** (not BrowserRouter) - Required for iframe display scenarios
- Routes:
  - `/` → POSScreen (main interface)
  - `/customer-display` → CustomerDisplay (secondary window for customer view)
- Fallback: Any unknown route redirects to `/`

### 3. **Component Layer: Tab-Based UI**
- **Main Hub:** `../src/pages/POSScreen.jsx`
- **Tabs:** 'pos' (sales), 'products', 'customers', 'providers', 'cash', 'sales', 'stats', 'settings'
- Each tab is a separate component in `../src/components/pos/`
- **All UI elements** use Radix UI primitives + Tailwind classes (no custom styled-components)

### 4. **Theme System**
- **File:** `../src/contexts/ThemeContext.jsx`
- Theme values: `'light'` | `'dark'` (stored in localStorage as `'ferrePOS_theme'`)
- Root HTML class toggling: `document.documentElement.classList.add/remove(theme)`
- Tailwind respects `darkMode: ['class']` in `../tailwind.config.js`

---

## Critical Patterns & Conventions

### **Product Validation**
Always validate product arrays with `validateAndCleanProducts()`:
- Removes duplicates (by `code`)
- Ensures required fields: `id`, `name`, `code`
- Coerces numeric fields to positive numbers
- Logs warnings for price < cost or negative stock

### **UI Component Structure**
- **Naming:** PascalCase (e.g., `ProductSearch.jsx`)
- **Utility Classes:** Use `cn()` from `../src/lib/utils.js` to merge Tailwind + conditional classes
- **Dialog/Modal:** Import from `../src/components/ui/` (Radix-wrapped)
- **Toast Notifications:** Import `{ toast }` from `@/components/ui/use-toast`

### **Keyboard Shortcuts**
Implemented in POSScreen.jsx (F-keys):
- **F2:** Focus product search
- **F6/F7:** Set payment method (cash/transfer)
- **F8/F9/F10:** Quote/Remit/Invoice buttons
- **Ctrl+P:** Print (not implemented)

### **Barcode Scanner Integration**
When a barcode is scanned in the product search:
1. **Exact Match Detection:** If the scanned code matches a product code exactly, it auto-adds to cart
2. **Auto-Increment:** Scanning the same product multiple times increments the quantity
3. **Auto-Clear:** After scanning, the search field clears automatically to allow next scan
4. **Implementation:** See `ProductSearch.jsx` line ~141-162 for the `useEffect` hook that detects exact matches and auto-adds via `addToCart()`
5. **Toast Feedback:** Shows confirmation toast when product is scanned ("Producto escaneado")

---

## Developer Workflows

### **Build & Development**
```bash
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

### **Vite Configuration Quirks**
- **Plugins:** Three custom plugins in `../plugins/`:
  1. `vite-plugin-edit-mode.js` - Visual editor mode for component editing
  2. `vite-plugin-react-inline-editor.js` - Inline editing with Babel AST manipulation
  3. `vite-plugin-iframe-route-restoration.js` - Handles iframe navigation states
- **Error Handlers:** Vite error overlay and console errors are forwarded to parent window via `window.parent.postMessage()` (intended for embedded mode)
- **Alias:** `@/` resolves to `src/` (via `vite.config.js`)

### **Critical Dependencies**
- **xlsx** & **jspdf** & **html2canvas** - Document export (CSV, PDF)
- **qrcode.react** - QR code generation
- **lucide-react** - Icon library (~40+ icons imported)
- **@radix-ui/** - Headless UI components
- **framer-motion** - Animations (motion divs)

---

## Data Persistence & localStorage

- **Key:** `'ferrePOS_data'` - Full POS state
- **Theme Key:** `'ferrePOS_theme'`
- **On Load:** POSContext hydrates from localStorage, falls back to sample data if empty
- **On Update:** Every dispatch immediately persists to localStorage
- **Sample Data:** 5 products, 3 providers, 2 customers included in context for demo

---

## Common Tasks for AI Agents

### **Adding a New Feature**
1. Define state shape in `../src/contexts/POSContext.jsx`
2. Add reducer action(s) for the feature
3. Create UI component in `../src/components/pos/`
4. Hook into tab system in `../src/pages/POSScreen.jsx`
5. Test localStorage persistence

### **Modifying Document/Invoice Output**
- Format settings live in `state.settings.document` (font, colors, watermark)
- Invoice logic: `../src/lib/invoicing.js`
- Components: `../src/components/pos/DocumentPreview.jsx`

### **Updating UI Styles**
- Modify **Tailwind classes** only (no CSS files in components)
- Dark/light variants: `dark:bg-slate-900 bg-white`
- Responsive: `md:`, `lg:` prefixes from Tailwind
- Custom colors already in config (border, input, ring, background, foreground, primary, etc.)

### **Adding License/Activation Logic**
- Gate component: `../src/components/LicenseGate.jsx`
- Wraps entire app in `../src/App.jsx`
- Modify activation logic here before showing POSProvider

---

## Files Worth Studying First

1. `../src/App.jsx` - App structure & wrapper hierarchy
2. `../src/contexts/POSContext.jsx` - State schema & actions
3. `../src/pages/POSScreen.jsx` - Main layout & keyboard shortcuts
4. `../tailwind.config.js` - Color & styling defaults
5. `../src/lib/invoicing.js` - Document generation logic

---

## Notes for Agents

- **No Backend:** All data is client-side. Implement sync manually if adding APIs later.
- **localStorage Limits:** ~5-10MB per domain. Monitor if adding large media/history.
- **HashRouter Requirement:** Do NOT change to BrowserRouter without updating iframe logic.
- **Sample Data:** Reset with browser console: `localStorage.removeItem('ferrePOS_data')`
- **Keyboard Event Handling:** Always check `isTyping` before intercepting F-keys (see POSScreen.jsx line ~40)
