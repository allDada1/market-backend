if (!window.API) window.API = "https://market-backend-if6s.onrender.com";
// Shared header/subbar renderer + common behaviors.
// If the page contains <div id="headerMount"></div> and <div id="subbarMount"></div>,
// this file will inject the standard markup from index.html. Otherwise it will only attach behavior.

(function () {
  const HEADER_HTML = `<header class="topbar">
  <div class="container topbar__inner topbar__playerok">
    <a class="brand" href="index.html">
      <span class="brand__dot"></span>
      <span class="brand__name">Store</span>
    </a>

    <div class="topSearch">
      <input id="searchInput" placeholder="Поиск товаров..." />
      <div class="searchSuggest" id="searchSuggest" hidden></div>
      <button class="topSearch__clear" id="clearBtn" type="button" title="Очистить">✕</button>
    </div>

    <nav class="topNav">
      <a class="topNav__a" href="index.html">Каталог</a>
      <a class="topNav__a" href="about/support.html" id="helpLink">Поддержка</a>

      <div class="dropdown" id="moreMenu">
        <!-- <button class="dropdown__btn" type="button">Меню ▾</button>
        <div class="dropdown__panel">
          <a href="category.html?cat=Гаджеты">Гаджеты</a>
          <a href="category.html?cat=Аудио">Аудио</a>
          <a href="category.html?cat=Компьютеры">Компьютеры</a>
          <a href="category.html?cat=Аксессуары">Аксессуары</a>
          <a href="favorites.html">Избранное</a>
          <a href="admin-categories.html" id="goAdminCats" style="display:none;">Админ категории</a>
        </div> -->
      </div>
    </nav>

    <div class="topbar__actions">
      <button class="iconBtn" id="cartBtn" type="button" title="Корзина">
        🛒 <span class="badge" id="cartBadge" hidden>0</span>
      </button>
      <div class="dropdown notifDrop" id="notifDrop">
        <button class="iconBtn dropdown__btn" id="notifBtn" type="button" title="Уведомления">
          🔔 <span class="badge" id="notifBadge" hidden>0</span>
        </button>
        <div class="dropdown__panel dropdown__panel--right">
          <div class="notifHead">
            <div class="notifHead__title">Уведомления</div>
            <div class="notifHead__actions">
              <button class="notifClearBtn" id="notifClearBtn" type="button" title="Очистить прочитанные">Очистить</button>
            </div>
          </div>
          <div class="notifList" id="notifPanel"></div>
        </div>
      </div>



      <div class="dropdown userDrop" id="userDrop">
        <button class="iconBtn dropdown__btn" type="button" id="profileBtn" title="Профиль">
          👤 <span>Войти</span>
        </button>
        <div class="dropdown__panel dropdown__panel--right">
          <a href="profile.html" id="goProfile">Профиль</a>
          <a href="admin-products.html" id="goAdmin" style="display:none;">Админ товары</a>
          <a href="login.html" id="goLogin">Вход</a>
          <a href="register.html" id="goReg">Регистрация</a>
        </div>
      </div>
    </div>
  </div>
</header>`;
  const SUBBAR_HTML = `<div class="subbar">
  <div class="container subbar__inner">
    <div class="catDrop" id="catDrop">
      <button class="catBtn" type="button" id="catBtn">Категории ▾</button>

      <div class="catPanel" id="catPanel">
      </div>
    </div>

    <div class="subLinks">
      <a href="category.html?cat=Игры">Игры</a>
      <a href="category.html?cat=Электроника">Электроника</a>
      <a href="favorites.html">Избранное</a>
    </div>
  </div>
</div>`;

  function getTokenAny() {
    try {
      if (window.Auth && typeof Auth.getToken === 'function') return Auth.getToken() || '';
      if (window.MarketAPI && typeof MarketAPI.getToken === 'function') return MarketAPI.getToken() || '';
    } catch {}
    return localStorage.getItem('market_token') || localStorage.getItem('token') || '';
  }

  function setCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    let count = 0;
    try {
      if (window.Storage && typeof Storage.getCartCount === 'function') count = Storage.getCartCount();
      else {
        const cart = JSON.parse(localStorage.getItem('market_cart')||'{}');
        count = Object.values(cart).reduce((a,b)=>a+(Number(b)||0),0);
      }
    } catch {}
    badge.textContent = String(count);
    badge.hidden = !count;
  }

  async function setProfileLabel() {
    const btn = document.getElementById('profileBtn');
    if (!btn) return;
    const span = btn.querySelector('span');
    const t = getTokenAny();
    if (!t) {
      if (span) span.textContent = 'Войти';
      return;
    }
    try {
      if (window.Auth && typeof Auth.getMe === 'function') {
        const me = await Auth.getMe();
        if (span) span.textContent = me?.name ? me.name : 'Профиль';
      } else {
        if (span) span.textContent = 'Профиль';
      }
    } catch {
      if (span) span.textContent = 'Профиль';
    }
  }

  function wireCommonClicks() {
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => {
        location.href = getTokenAny() ? 'cart.html' : 'login.html';
      });
    }

    const goLogin = document.getElementById('goLogin');
    if (goLogin) goLogin.addEventListener('click', (e) => { e.preventDefault(); location.href = 'login.html'; });
    const goReg = document.getElementById('goReg');
    if (goReg) goReg.addEventListener('click', (e) => { e.preventDefault(); location.href = 'register.html'; });

    const goProfile = document.getElementById('goProfile');
    if (goProfile) goProfile.addEventListener('click', (e) => {
      e.preventDefault();
      location.href = getTokenAny() ? 'profile.html' : 'login.html';
    });
  }

  // Some pages previously relied on js/dropdowns.js & js/categories-bar.js.
  // After we moved the header into a shared component, those scripts might not be loaded.
  // This lightweight fallback reproduces the same behavior (toggle .dropdown via .dropdown__btn,
  // close on outside click / ESC, and categories dropdown toggle).
  function ensureDropdownFallback() {
    if (document.documentElement.dataset.dmDropdowns === '1') return;
    document.documentElement.dataset.dmDropdowns = '1';

    function closeAll(except) {
      document.querySelectorAll('.dropdown.is-open').forEach(d => {
        if (except && d === except) return;
        d.classList.remove('is-open');
      });
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.dropdown__btn');
      const drop = e.target.closest('.dropdown');

      if (btn && drop) {
        const isOpen = drop.classList.contains('is-open');
        closeAll(drop);
        drop.classList.toggle('is-open', !isOpen);
        return;
      }

      // click inside panel shouldn't close
      if (e.target.closest('.dropdown__panel')) return;
      closeAll(null);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll(null);
    });

    // categories dropdown (subbar)
    const catDrop = document.getElementById('catDrop');
    const catBtn = document.getElementById('catBtn');
    if (catDrop && catBtn && !catDrop.dataset.wired) {
      catDrop.dataset.wired = '1';
      function close(){ catDrop.classList.remove('is-open'); }
      catBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        catDrop.classList.toggle('is-open');
      });
      document.addEventListener('click', (ev) => {
        if (ev.target.closest('#catDrop')) return;
        close();
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') close();
      });
    }
  }

  function renderIfMountsExist() {
    const hm = document.getElementById('headerMount');
    if (hm && !hm.dataset.rendered) {
      hm.innerHTML = HEADER_HTML;
      hm.dataset.rendered = '1';
    }
    const sm = document.getElementById('subbarMount');
    if (sm && !sm.dataset.rendered) {
      sm.innerHTML = SUBBAR_HTML;
      sm.dataset.rendered = '1';
    }
  }

  function init() {
    renderIfMountsExist();
    ensureDropdownFallback();
    setCartBadge();
    setProfileLabel();
    wireCommonClicks();
  }

  // run early and also on DOMContentLoaded (safe for pages that load scripts in <head>)
  try { init(); } catch {}
  document.addEventListener('DOMContentLoaded', () => { try { init(); } catch {} });

  window.Header = { init };
})();
