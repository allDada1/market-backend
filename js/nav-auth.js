// js/nav-auth.js
(function () {
  // Куда вести
  const go = (url) => { location.href = url; };

  // Хедер-кнопки (если они есть на странице)
  const loginBtn    = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const profileLink = document.getElementById("profileLink");

  if (loginBtn) {
    loginBtn.type = "button";
    loginBtn.addEventListener("click", (e) => { e.preventDefault(); go("login.html"); });
  }
  if (registerBtn) {
    registerBtn.type = "button";
    registerBtn.addEventListener("click", (e) => { e.preventDefault(); go("register.html"); });
  }
  if (profileLink) {
    profileLink.addEventListener("click", (e) => { e.preventDefault(); go("profile.html"); });
  }

  // Страница логина: кнопка "Войти"
  const loginSubmit = document.getElementById("loginSubmit");
  if (loginSubmit) loginSubmit.type = "button";

  // Страница регистрации: кнопка "Создать"
  const registerSubmit = document.getElementById("registerSubmit");
  if (registerSubmit) registerSubmit.type = "button";
})();