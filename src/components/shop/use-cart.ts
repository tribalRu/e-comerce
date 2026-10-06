"use client";

// Хук корзины: ходит в /api/cart*, держит состояние синхронным с сервером

import { useCallback, useEffect, useState } from "react";
import type { CartState } from "./types";

const EMPTY_STATE: CartState = { cartId: null, items: [], count: 0, subtotal: 0 };

export function useCart() {
  const [state, setState] = useState<CartState>(EMPTY_STATE);
  const [busy, setBusy] = useState(false);

  const applyResponse = useCallback(async (res: Response) => {
    if (res.ok) {
      setState((await res.json()) as CartState);
      return true;
    }
    return false;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      await applyResponse(res);
    } catch {
      // сеть недоступна — оставляем прошлое состояние
    }
  }, [applyResponse]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addToCart = useCallback(
    async (productId: number, quantity = 1): Promise<boolean> => {
      setBusy(true);
      try {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, quantity }),
        });
        return await applyResponse(res);
      } catch {
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyResponse],
  );

  const updateQty = useCallback(
    async (itemId: string, quantity: number): Promise<boolean> => {
      setBusy(true);
      try {
        const res = await fetch(`/api/cart/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity }),
        });
        return await applyResponse(res);
      } catch {
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyResponse],
  );

  const removeItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      setBusy(true);
      try {
        const res = await fetch(`/api/cart/${itemId}`, { method: "DELETE" });
        return await applyResponse(res);
      } catch {
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyResponse],
  );

  return { ...state, busy, refresh, addToCart, updateQty, removeItem };
}

export type CartApi = ReturnType<typeof useCart>;
