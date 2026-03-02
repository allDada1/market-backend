// js/core/storage.js
// Single source of truth for localStorage keys.

(function (global) {
  const CART_KEY = "market_cart";

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function getCart() {
    const raw = global.localStorage.getItem(CART_KEY);
    const obj = raw ? safeParse(raw, {}) : {};
    // Ensure plain object
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    return obj;
  }

  function setCart(cartObj) {
    global.localStorage.setItem(CART_KEY, JSON.stringify(cartObj || {}));
  }

  function getCartCount() {
    const cart = getCart();
    let n = 0;
    for (const k of Object.keys(cart)) {
      n += Number(cart[k]) || 0;
    }
    return n;
  }

  function addToCart(productId, qty = 1) {
    const cart = getCart();
    const key = String(productId);
    cart[key] = (Number(cart[key]) || 0) + (Number(qty) || 0);
    if (cart[key] <= 0) delete cart[key];
    setCart(cart);
    return cart;
  }

  function removeFromCart(productId) {
    const cart = getCart();
    delete cart[String(productId)];
    setCart(cart);
    return cart;
  }

  global.Storage = {
    CART_KEY,
    getCart,
    setCart,
    getCartCount,
    addToCart,
    removeFromCart,
  };
})(window);