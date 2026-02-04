import { useState, useEffect, useCallback } from 'react';

const FAVORITES_KEY = 'pos_favorites';
const RECENT_CUSTOMERS_KEY = 'pos_recent_customers';
const MAX_FAVORITES = 12;
const MAX_RECENT_CUSTOMERS = 5;

interface FavoriteProduct {
  id: string;
  name: string;
  price: number;
  sku?: string;
}

interface RecentCustomer {
  id: string;
  name: string;
  phone?: string;
  lastUsed: string;
}

// Favorites management
export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites: FavoriteProduct[]) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const addFavorite = useCallback(
    (product: FavoriteProduct) => {
      setFavorites((prev) => {
        // Don't add duplicates
        if (prev.some((f) => f.id === product.id)) {
          return prev;
        }
        // Limit to max favorites
        const newFavorites = [product, ...prev].slice(0, MAX_FAVORITES);
        saveFavorites(newFavorites);
        return newFavorites;
      });
    },
    [saveFavorites]
  );

  const removeFavorite = useCallback(
    (productId: string) => {
      setFavorites((prev) => {
        const newFavorites = prev.filter((f) => f.id !== productId);
        saveFavorites(newFavorites);
        return newFavorites;
      });
    },
    [saveFavorites]
  );

  const isFavorite = useCallback(
    (productId: string) => {
      return favorites.some((f) => f.id === productId);
    },
    [favorites]
  );

  const reorderFavorites = useCallback(
    (fromIndex: number, toIndex: number) => {
      setFavorites((prev) => {
        const newFavorites = [...prev];
        const [moved] = newFavorites.splice(fromIndex, 1);
        newFavorites.splice(toIndex, 0, moved);
        saveFavorites(newFavorites);
        return newFavorites;
      });
    },
    [saveFavorites]
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    localStorage.removeItem(FAVORITES_KEY);
  }, []);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    reorderFavorites,
    clearFavorites,
  };
}

// Recent customers management
export function useRecentCustomers() {
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_CUSTOMERS_KEY);
      if (stored) {
        setRecentCustomers(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const saveRecentCustomers = useCallback((customers: RecentCustomer[]) => {
    try {
      localStorage.setItem(RECENT_CUSTOMERS_KEY, JSON.stringify(customers));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const addRecentCustomer = useCallback(
    (customer: Omit<RecentCustomer, 'lastUsed'>) => {
      setRecentCustomers((prev) => {
        // Remove if already exists
        const filtered = prev.filter((c) => c.id !== customer.id);
        // Add to front with timestamp
        const newCustomers = [
          { ...customer, lastUsed: new Date().toISOString() },
          ...filtered,
        ].slice(0, MAX_RECENT_CUSTOMERS);
        saveRecentCustomers(newCustomers);
        return newCustomers;
      });
    },
    [saveRecentCustomers]
  );

  const clearRecentCustomers = useCallback(() => {
    setRecentCustomers([]);
    localStorage.removeItem(RECENT_CUSTOMERS_KEY);
  }, []);

  return {
    recentCustomers,
    addRecentCustomer,
    clearRecentCustomers,
  };
}

// Quick discount presets
export const QUICK_DISCOUNTS = [
  { label: '5%', value: 5 },
  { label: '10%', value: 10 },
  { label: '15%', value: 15 },
  { label: '20%', value: 20 },
] as const;

// Quick amount presets for payment
export function getQuickAmounts(remaining: number): number[] {
  // Generate useful quick amounts based on remaining
  const amounts: number[] = [];

  // Add exact amount
  if (remaining > 0) {
    amounts.push(remaining);
  }

  // Round up to common denominations
  const denominations = [100, 500, 1000, 2000, 5000, 10000];

  for (const denom of denominations) {
    const roundedUp = Math.ceil(remaining / denom) * denom;
    if (roundedUp > remaining && roundedUp <= remaining * 2 && !amounts.includes(roundedUp)) {
      amounts.push(roundedUp);
    }
  }

  // Sort and limit
  return amounts.sort((a, b) => a - b).slice(0, 4);
}

// Calculate discount
export function calculateDiscount(
  subtotal: number,
  discountType: 'percentage' | 'fixed',
  discountValue: number
): number {
  if (discountType === 'percentage') {
    return Math.round((subtotal * discountValue) / 100);
  }
  return Math.min(discountValue, subtotal);
}
