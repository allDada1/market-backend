(function () {

  function getTokenAny(){
    try{
      const t = (window.MarketAPI && typeof MarketAPI.getToken === "function")
        ? (MarketAPI.getToken() || "")
        : "";
      return t ||
        localStorage.getItem("market_token") ||
        localStorage.getItem("token") ||
        "";
    }catch{
      return localStorage.getItem("market_token") ||
             localStorage.getItem("token") ||
             "";
    }
  }

  function initHeader(){
    const token = getTokenAny();

    const profileBtn = document.getElementById("profileBtn");
    const cartBtn = document.getElementById("cartBtn");
    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");

    // Профиль
    if (profileBtn){
      profileBtn.onclick = () => {
        location.href = token ? "profile.html" : "login.html";
      };
    }

    // Корзина
    if (cartBtn){
      cartBtn.onclick = () => {
        location.href = token ? "cart.html" : "login.html";
      };
    }

    // Скрытие кнопок
    if (token){
      if (loginBtn) loginBtn.style.display = "none";
      if (registerBtn) registerBtn.style.display = "none";
    }

    // Dropdown
    const dropdown = document.querySelector(".dropdown");
    profileBtn?.addEventListener("click", (e)=>{
      e.stopPropagation();
      dropdown?.classList.toggle("is-open");
    });

    document.addEventListener("click", ()=>{
      dropdown?.classList.remove("is-open");
    });
  }

  document.addEventListener("DOMContentLoaded", initHeader);

})();