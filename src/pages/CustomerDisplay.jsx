// src/components/pos/CustomerDisplay.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, CreditCard, DollarSign, Receipt } from 'lucide-react';
import { usePOS } from '@/contexts/POSContext';

const STORAGE_KEY = 'ferrePOS_data';

export default function CustomerDisplay() {
  const { state: globalState } = usePOS();

  const [displayData, setDisplayData] = useState({
    cart: [],
    currentCustomer: null,
    paymentMethod: 'cash',
    paymentAmount: 0,
    discount: 0,
    total: 0,
  });

  const channelRef = useRef(null);

  /* ================================================================
     Helpers
  ================================================================ */
  const calcTotal = (cart, discount, taxRate) => {
    const subtotal = (cart || []).reduce(
      (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
      0
    );
    const itemDiscounts = (cart || []).reduce(
      (sum, it) => sum + Number(it.itemDiscount || 0),
      0
    );
    const base = subtotal - itemDiscounts;
    const rate = Number(taxRate || 0);
    const tax = base * rate;
    return base + tax - Number(discount || 0);
  };

  const hydrateFromStorage = () => {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const cart = parsed.cart || [];
      const currentCustomer = parsed.currentCustomer || null;
      const paymentMethod = parsed.paymentMethod || 'cash';
      const paymentAmount = Number(parsed.paymentAmount || 0);
      const discount = Number(parsed.discount || 0);
      const taxRate = globalState?.settings?.taxRate || 0;
      const total = calcTotal(cart, discount, taxRate);
      setDisplayData({ cart, currentCustomer, paymentMethod, paymentAmount, discount, total });
    } catch {
      // noop
    }
  };

  /* ================================================================
     Montaje: título + precarga desde storage
  ================================================================ */
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const name = globalState?.settings?.companyName || 'Despensa Neon';
      document.title = name;
    }
    hydrateFromStorage();
  }, []);

  /* ================================================================
     Suscripción a BroadcastChannel + fallback a storage (blindada)
  ================================================================ */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event) => {
      if (event?.data?.type !== 'STATE_UPDATE') return;

const {
  cart,
  currentCustomer,
  paymentMethod,
  paymentAmount,
  discount,
  subtotal,
  taxAmount,
  total,
  isEmpty,
} = event.data;

      setDisplayData((prev) => {
  const isCartValid = Array.isArray(cart) && cart.length > 0;
  const shouldReset =
    Array.isArray(cart) && cart.length === 0 && Number(total || 0) === 0;

  // ✅ Mantener el carrito anterior si llega vacío pero no hay reset
  const updatedCart = shouldReset ? [] : isCartValid ? cart : prev.cart;

  const computedTotal =
    typeof total === 'number'
      ? total
      : calcTotal(
          updatedCart,
          discount ?? prev.discount,
          globalState?.settings?.taxRate ?? 0
        );

  return {
    cart: isEmpty ? [] : updatedCart,
    currentCustomer:
      currentCustomer !== undefined
        ? currentCustomer
        : prev.currentCustomer,
    paymentMethod: paymentMethod ?? prev.paymentMethod,
    paymentAmount: Number(paymentAmount ?? prev.paymentAmount ?? 0),
    discount: Number(discount ?? prev.discount ?? 0),
    subtotal: Number(subtotal ?? prev.subtotal ?? 0),
    taxAmount: Number(taxAmount ?? prev.taxAmount ?? 0),
    total: Number(total ?? computedTotal ?? 0),
  };
});

    };

    // 1️⃣ Suscripción al canal
    try {
      if ('BroadcastChannel' in window) {
        channelRef.current = new BroadcastChannel('ferrePOS');
        channelRef.current.addEventListener('message', handleMessage);
      }
    } catch (err) {
      console.warn('BroadcastChannel fallback:', err);
    }

    // 2️⃣ Fallback por localStorage
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      hydrateFromStorage();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      try {
        if (channelRef.current) {
          channelRef.current.removeEventListener('message', handleMessage);
          channelRef.current.close();
        }
      } catch {
        // noop
      }
      window.removeEventListener('storage', onStorage);
    };
  }, [globalState?.settings?.taxRate]);

  /* ================================================================
     Derivados para render
  ================================================================ */
  const subtotal = useMemo(
    () =>
      (displayData.cart || []).reduce(
        (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
        0
      ),
    [displayData.cart]
  );

  const totalItemDiscount = useMemo(
    () => (displayData.cart || []).reduce((sum, it) => sum + Number(it.itemDiscount || 0), 0),
    [displayData.cart]
  );

  const tax = useMemo(() => {
    const rate = Number(globalState?.settings?.taxRate || 0);
    return (subtotal - totalItemDiscount) * rate;
  }, [subtotal, totalItemDiscount, globalState?.settings?.taxRate]);

  const change =
    displayData.paymentMethod === 'cash'
      ? Math.max(0, Number(displayData.paymentAmount || 0) - Number(displayData.total || 0))
      : 0;

  const getPaymentIcon = () => {
    switch (displayData.paymentMethod) {
      case 'cash':
        return <DollarSign className="h-8 w-8" />;
      case 'transfer':
        return <CreditCard className="h-8 w-8" />;
      case 'mixed':
        return (
          <span className="flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            <CreditCard className="h-8 w-8" />
          </span>
        );
      default:
        return <Receipt className="h-8 w-8" />;
    }
  };

  const getPaymentLabel = () => {
    switch (displayData.paymentMethod) {
      case 'cash':
        return 'Efectivo';
      case 'transfer':
        return 'Transferencia';
      case 'mixed':
        return 'Mixto';
      default:
        return 'Efectivo';
    }
  };

  /* ================================================================
     Render principal
  ================================================================ */
  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-5xl mx-auto"
      >
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold">
            {globalState?.settings?.companyName || 'Despensa Neon'}
          </h1>
          <p className="text-2xl text-muted-foreground mt-2">Gracias por su compra</p>
        </div>

        {displayData.currentCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card-glass p-6 rounded-lg mb-6 text-center"
          >
            <h2 className="text-2xl font-semibold">
              Cliente:{' '}
              <span className="text-primary">{displayData.currentCustomer?.name}</span>
            </h2>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Columna izquierda: Carrito */}
          <div className="card-glass p-6 rounded-lg">
            <h2 className="text-3xl font-semibold mb-4 flex items-center">
              <ShoppingCart className="h-8 w-8 mr-3" />
              Su Compra
            </h2>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <AnimatePresence initial={false}>
                  {(!displayData.cart || displayData.cart.length === 0) && Number(displayData.total) === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-12"
                  >
                    <ShoppingCart className="h-20 w-20 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground text-xl">El carrito está vacío</p>
                  </motion.div>
                ) : (
                  displayData.cart.map((item, index) => {
                    const line = Number(item.price || 0) * Number(item.quantity || 0);
                    return (
                      <motion.div
                        key={item.cartId || `${item.id}_${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.04 }}
                        className="flex items-center justify-between p-4 bg-background/50 rounded-lg text-lg"
                      >
                        <div className="flex-1">
                          <h3 className="font-medium">{item.name}</h3>
                          <p className="text-muted-foreground text-base">
                            {Number(item.quantity || 0)} {item.unit} × $
                            {Number(item.price || 0).toFixed(2)}
                          </p>
                        </div>
                        <p className="font-semibold text-xl">${line.toFixed(2)}</p>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Columna derecha: Resumen y Pago */}
          <div className="space-y-8">
            <div className="card-glass p-6 rounded-lg">
              <h2 className="text-3xl font-semibold mb-4">Resumen</h2>
              <div className="space-y-3 text-xl">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                {(totalItemDiscount > 0 || Number(displayData.discount) > 0) && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuentos:</span>
                    <span>
                      -${(totalItemDiscount + Number(displayData.discount || 0)).toFixed(2)}
                    </span>
                  </div>
                )}

                {globalState?.settings?.taxRate > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      IVA ({(Number(globalState?.settings?.taxRate) * 100).toFixed(0)}%)
                    </span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-muted-foreground">
                    <span>IVA:</span>
                    <span>$0.00</span>
                  </div>
                )}

                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex justify-between text-4xl font-bold">
                    <span>Total:</span>
                    <span className="rounded-lg px-2">
                      ${Number(displayData.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {Number(displayData.paymentAmount) > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-glass p-6 rounded-lg"
              >
                <h2 className="text-3xl font-semibold mb-4 flex items-center">
                  {getPaymentIcon()}
                  <span className="ml-3">Pago</span>
                </h2>
                <div className="space-y-3 text-xl">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Método:</span>
                    <span className="font-medium">{getPaymentLabel()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Recibido:</span>
                    <span>${Number(displayData.paymentAmount || 0).toFixed(2)}</span>
                  </div>
                  {Number(change) > 0 && (
                    <div className="flex justify-between text-green-600 text-2xl font-semibold">
                      <span>Vuelto:</span>
                      <span>${Number(change).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
