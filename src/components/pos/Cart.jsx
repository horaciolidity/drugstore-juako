// src/components/pos/Cart.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Trash2,
  Edit,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePOS } from "@/contexts/POSContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import NumericInput from "@/components/common/NumericInput";

const CartItem = ({ item, onUpdate, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    price: typeof item.price === "number" ? item.price : null,
    discount: item.itemDiscount || 0,
    note: item.note || "",
  });

  const handleUpdate = () => {
    const priceNum = typeof editData.price === "number" ? editData.price : 0;
    const itemCost = typeof item.cost === "number" ? item.cost : 0;

    if (priceNum < itemCost) {
      if (
        !window.confirm(
          "El precio es menor que el costo. ¿Desea continuar?"
        )
      ) {
        return;
      }
    }

    onUpdate({
      price: priceNum,
      itemDiscount:
        typeof editData.discount === "number"
          ? editData.discount
          : parseFloat(editData.discount) || 0,
      note: editData.note,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({
      price: typeof item.price === "number" ? item.price : null,
      discount: item.itemDiscount || 0,
      note: item.note || "",
    });
  };

  const handleDiscountChange = (value) => {
    // Permite "$" directo (número) o "%": "10%"
    const raw = String(value).trim();
    if (raw.endsWith("%")) {
      const percentage = parseFloat(raw.slice(0, -1)) || 0;
      const discountAmount =
        ((item.price * item.quantity) / 100) * percentage;
      setEditData({ ...editData, discount: Number(discountAmount.toFixed(2)) });
    } else {
      setEditData({
        ...editData,
        discount: raw === "" ? 0 : parseFloat(raw) || 0,
      });
    }
  };

  // Cantidad editable en la fila principal (fuera del modo edición)
  const onQtyChange = (v) => {
    const qty =
      typeof v === "number" && !Number.isNaN(v) && v >= 0 ? v : 0;
    onUpdate({ quantity: qty });
  };

  const subtotal =
    (typeof item.price === "number" ? item.price : 0) *
      (typeof item.quantity === "number" ? item.quantity : 0) -
    (item.itemDiscount || 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="card-glass p-4 rounded-lg text-base"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-semibold truncate flex-1">{item.name}</span>

        <div className="flex items-center w-28">
          <NumericInput
            allowDecimal={item.unit !== "unidad"}
            value={item.quantity}
            onChange={onQtyChange}
            className="h-9 w-full text-center"
          />
        </div>

        <span className="w-24 text-center">
          ${Number(item.price || 0).toFixed(2)}
        </span>
        <span className="w-24 text-center text-green-500">
          -${Number(item.itemDiscount || 0).toFixed(2)}
        </span>
        <span className="font-semibold w-28 text-right">
          ${Number(subtotal).toFixed(2)}
        </span>

        <div className="flex items-center">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-primary"
            onClick={() => setIsEditing((s) => !s)}
          >
            <Edit size={16} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive"
            onClick={onRemove}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Precio</label>
                <NumericInput
                  value={editData.price}
                  onChange={(v) =>
                    setEditData({
                      ...editData,
                      price: typeof v === "number" ? v : null,
                    })
                  }
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  Descuento ($ o %)
                </label>
                {/* Deja Input "libre" para poder escribir 10% */}
                <Input
                  value={
                    typeof editData.discount === "number"
                      ? editData.discount
                      : String(editData.discount || "")
                  }
                  onChange={(e) => handleDiscountChange(e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Nota</label>
                <Textarea
                  value={editData.note}
                  onChange={(e) =>
                    setEditData({ ...editData, note: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleUpdate}>
                <Check className="h-4 w-4 mr-1" /> Guardar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {item.note && !isEditing && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-start gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p className="flex-1">{item.note}</p>
        </div>
      )}
    </motion.div>
  );
};

export default function Cart() {
  const { state, dispatch, calculateTotal, calculateProfit } = usePOS();
  const { isAdmin } = useAuth();

  const updateCartItem = (cartId, updates) => {
    dispatch({ type: "UPDATE_CART_ITEM", payload: { cartId, updates } });
  };

  const removeItem = (cartId) => {
    dispatch({ type: "REMOVE_FROM_CART", payload: cartId });
  };

  const total = calculateTotal();
  const profit = calculateProfit();

  return (
    <div className="card-glass p-6 rounded-lg text-base">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <ShoppingCart className="h-6 w-6 mr-2" />
          Carrito ({state.cart.length})
        </h2>
        {state.cart.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => dispatch({ type: "CLEAR_CART" })}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="hidden md:flex items-center justify-between text-muted-foreground/80 text-sm px-4 pb-2 border-b border-border gap-4">
        <span className="flex-1">Producto</span>
        <span className="w-28 text-center">Cantidad</span>
        <span className="w-24 text-center">Precio</span>
        <span className="w-24 text-center">Desc.</span>
        <span className="w-28 text-right">Subtotal</span>
        <span className="w-20"></span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin my-4">
        <AnimatePresence>
          {state.cart.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground text-lg">
                El carrito está vacío
              </p>
            </motion.div>
          ) : (
            state.cart.map((item) => (
              <CartItem
                key={item.cartId}
                item={item}
                onUpdate={(updates) => updateCartItem(item.cartId, updates)}
                onRemove={() => removeItem(item.cartId)}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {state.cart.length > 0 && (
        <div className="border-t border-border pt-4 space-y-2 text-lg">
          {isAdmin && (
            <div className="flex justify-between text-green-500">
              <span>Ganancia de la venta:</span>
              <span>${profit.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-foreground text-2xl font-bold">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      )}
      
    </div>
  );
}
