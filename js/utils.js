export const API = "https://market-backend-if6s.onrender.com";
// utils.js — общие утилиты для проекта Market
// - Без зависимостей
// - Экспортирует window.MarketUtils
// - Добавляет "legacy" глобальные функции, если их ещё нет (чтобы старый код не ломался)
(function () {
  // ---------- text/format ----------
  function formatKZT(value) {
    const s = String(Math.round(Number(value) || 0));
    const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${spaced} ₸`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- url ----------
  function getQueryParam(name) {
    const sp = new URLSearchParams(location.search);
    const v = sp.get(name);
    return v == null ? "" : String(v);
  }

  // ---------- cart ----------
  const CART_KEY = "market_cart";

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart || {}));
  }

  function cartCount(cart) {
    return Object.values(cart || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  /**
   * updateCartBadge(badgeElOrId, { hideWhenZero?: boolean })
   */
  function updateCartBadge(badgeElOrId, opts) {
    const o = opts || {};
    const el =
      typeof badgeElOrId === "string"
        ? document.getElementById(badgeElOrId)
        : badgeElOrId;

    if (!el) return;

    const c = cartCount(loadCart());
    el.textContent = String(c);

    if (o.hideWhenZero) el.hidden = c <= 0;
  }

  /**
   * addToCart(productId, badgeElOrId?, { hideWhenZero?: boolean })
   */
  function addToCart(productId, badgeElOrId, opts) {
    const cart = loadCart();
    const k = String(productId);
    cart[k] = (Number(cart[k]) || 0) + 1;
    saveCart(cart);

    if (badgeElOrId) updateCartBadge(badgeElOrId, opts);
  }

  

// ---------- theme / language ----------
function applyTheme(theme){
  const t = (theme || localStorage.getItem("market_theme") || "").toLowerCase();
  const v = (t === "light" || t === "dark") ? t : "dark";
  document.documentElement.dataset.theme = v;
  localStorage.setItem("market_theme", v);
  return v;
}

function applyLang(lang){
  const l = (lang || localStorage.getItem("market_lang") || "").toLowerCase();
  const v = ["ru","kz","en"].includes(l) ? l : "ru";
  document.documentElement.dataset.lang = v;
  localStorage.setItem("market_lang", v);
  return v;
}

// ---------- expose ----------
  const MarketUtils = {
    formatKZT,
    escapeHtml,
    getQueryParam,

    loadCart,
    saveCart,
    cartCount,
    updateCartBadge,
    addToCart,

    applyTheme,
    applyLang,
  };

  window.MarketUtils = MarketUtils;

  // ---------- legacy globals (only if not defined) ----------
  if (typeof window.formatKZT !== "function") window.formatKZT = formatKZT;
  if (typeof window.escapeHtml !== "function") window.escapeHtml = escapeHtml;

  if (typeof window.loadCart !== "function") window.loadCart = loadCart;
  if (typeof window.saveCart !== "function") window.saveCart = saveCart;
  if (typeof window.updateCartBadge !== "function") window.updateCartBadge = function () {
    // старый код обычно зовёт updateCartBadge() без параметров и ожидает #cartBadge
    const badge = document.getElementById("cartBadge");
    updateCartBadge(badge, { hideWhenZero: false });
  };
  if (typeof window.addToCart !== "function") window.addToCart = addToCart;
  if (typeof window.applyTheme !== "function") window.applyTheme = applyTheme;
  if (typeof window.applyLang !== "function") window.applyLang = applyLang;
})();

// Apply saved UI prefs early
try { window.MarketUtils?.applyTheme(); window.MarketUtils?.applyLang(); } catch {}