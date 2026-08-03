"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addLine,
  cartCount,
  cartSubtotal,
  CART_STORAGE_KEY,
  parseStoredCart,
  setLineQuantity,
  type CartLine,
} from "@/lib/cart";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  /** False until localStorage has been read, so the header badge does not
   *  flash the wrong number during hydration. */
  ready: boolean;
  add: (line: CartLine) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY)));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  // Keep two open tabs in step.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === CART_STORAGE_KEY) {
        setLines(parseStoredCart(event.newValue));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((line: CartLine) => {
    setLines((current) => addLine(current, line));
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((current) => setLineQuantity(current, variantId, quantity));
  }, []);

  const remove = useCallback((variantId: string) => {
    setLines((current) => current.filter((line) => line.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: cartCount(lines),
      subtotal: cartSubtotal(lines),
      ready,
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside a CartProvider");
  }
  return context;
}
