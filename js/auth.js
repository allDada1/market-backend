// Auth page — первая версия с персонажами
// Логика аккаунта пока локальная (localStorage). Потом расширим.

const el = {
  tabLogin: document.getElementById("tabLogin"),
  tabRegister: document.getElementById("tabRegister"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),

  loginId: document.getElementById("loginId"),
  loginPass: document.getElementById("loginPass"),
  regName: document.getElementById("regName"),
  regEmail: document.getElementById("regEmail"),
  regPass: document.getElementById("regPass"),

  loginMsg: document.getElementById("loginMsg"),
  regMsg: document.getElementById("regMsg"),

  stage: document.getElementById("stage"),
  statusLine: document.getElementById("statusLine"),

  dudeA: document.getElementById("dudeA"),
  dudeB: document.getElementById("dudeB"),
};

const dudes = [el.dudeA, el.dudeB];

function setStatus(text){
  el.statusLine.querySelector("span:last-child").textContent = text;
}

function setTab(mode){
  const isLogin = mode === "login";

  el.tabLogin.classList.toggle("is-active", isLogin);
  el.tabRegister.classList.toggle("is-active", !isLogin);

  el.tabLogin.setAttribute("aria-selected", String(isLogin));
  el.tabRegister.setAttribute("aria-selected", String(!isLogin));

  el.loginForm.hidden = !isLogin;
  el.registerForm.hidden = isLogin;

  el.loginMsg.textContent = "";
  el.regMsg.textContent = "";

  setStatus(isLogin ? "Режим: Вход" : "Режим: Регистрация");
}

// ---------- “человечки” ----------

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function setPupilsByPointer(clientX, clientY){
  const rect = el.stage.getBoundingClientRect();
  const nx = (clientX - rect.left) / rect.width;   // 0..1
  const ny = (clientY - rect.top) / rect.height;   // 0..1

  // смещение зрачка
  const dx = clamp((nx - 0.5) * 16, -10, 10);
  const dy = clamp((ny - 0.5) * 16, -10, 10);

  dudes.forEach(d => {
    d.querySelectorAll(".pupil").forEach(p => {
      p.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
    });

    // лёгкий наклон головы в сторону курсора
    const head = d.querySelector(".dude__head");
    const tilt = clamp((nx - 0.5) * 6, -4, 4);
    head.style.transform = `rotate(${tilt}deg)`;
  });
}

function setPasswordMode(on){
  el.stage.classList.toggle("is-password", on);
  setStatus(on ? "Тсс... пароль." : "Ожидание...");
}

function setCuriousMode(on){
  el.stage.classList.toggle("is-curious", on);
  if (on) setStatus("О, вводишь данные...");
}

function nope(){
  dudes.forEach(d => {
    d.classList.remove("is-nope");
    // перезапуск анимации
    void d.offsetWidth;
    d.classList.add("is-nope");
  });
  setStatus("Пароль неверный. Они недовольны.");
}

el.stage.addEventListener("mousemove", (e) => setPupilsByPointer(e.clientX, e.clientY));
el.stage.addEventListener("mouseleave", () => {
  // вернуть зрачки в центр
  dudes.forEach(d => d.querySelectorAll(".pupil").forEach(p => p.style.transform = `translate(-50%, -50%)`));
  setCuriousMode(false);
  setPasswordMode(false);
  setStatus("Ожидание...");
});

// реакции на фокус
function bindFocusCurious(inputEl){
  inputEl.addEventListener("focus", () => setCuriousMode(true));
  inputEl.addEventListener("blur", () => setCuriousMode(false));
}

bindFocusCurious(el.loginId);
bindFocusCurious(el.regName);
bindFocusCurious(el.regEmail);

function bindPassword(inputEl){
  inputEl.addEventListener("focus", () => setPasswordMode(true));
  inputEl.addEventListener("blur", () => setPasswordMode(false));
}
bindPassword(el.loginPass);
bindPassword(el.regPass);

// ---------- аккаунты (локально) ----------
// Хранилище пользователей: market_users = [{name,email,pass}]
function loadUsers(){
  try{
    return JSON.parse(localStorage.getItem("market_users") || "[]");
  }catch{
    return [];
  }
}
function saveUsers(users){
  localStorage.setItem("market_users", JSON.stringify(users));
}
function setSession(user){
  localStorage.setItem("market_session", JSON.stringify({ email: user.email, name: user.name }));
}

// ---------- события вкладок ----------
el.tabLogin.addEventListener("click", () => setTab("login"));
el.tabRegister.addEventListener("click", () => setTab("register"));

// ---------- submit ----------
el.registerForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = el.regName.value.trim();
  const email = el.regEmail.value.trim().toLowerCase();
  const pass = el.regPass.value;

  if (!name || !email || !pass){
    el.regMsg.textContent = "Заполни все поля.";
    nope();
    return;
  }
  if (pass.length < 6){
    el.regMsg.textContent = "Пароль слишком короткий (минимум 6).";
    nope();
    return;
  }

  const users = loadUsers();
  if (users.some(u => u.email === email)){
    el.regMsg.textContent = "Такой email уже зарегистрирован.";
    nope();
    return;
  }

  const user = { name, email, pass };
  users.push(user);
  saveUsers(users);
  setSession(user);

  el.regMsg.textContent = "Аккаунт создан. Перекидываю на главную…";
  setStatus("Они одобряют. Почти.");
  setTimeout(() => {
    window.location.href = "index.html";
  }, 650);
});

el.loginForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const loginId = el.loginId.value.trim().toLowerCase();
  const pass = el.loginPass.value;

  if (!loginId || !pass){
    el.loginMsg.textContent = "Заполни логин и пароль.";
    nope();
    return;
  }

  const users = loadUsers();
  const user = users.find(u => u.email === loginId || u.name.toLowerCase() === loginId);

  if (!user || user.pass !== pass){
    el.loginMsg.textContent = "Неверный логин или пароль.";
    nope();
    return;
  }

  setSession(user);
  el.loginMsg.textContent = `Добро пожаловать, ${user.name}. Перекидываю на главную…`;
  setStatus("Окей. Проходи.");
  setTimeout(() => {
    window.location.href = "index.html";
  }, 650);
});

// фейк “забыли пароль”
document.getElementById("fakeForgot").addEventListener("click", () => {
  setStatus("Потом сделаем восстановление. Сейчас — дипломатично игнорируем 😄");
});

// init
setTab("login");
setStatus("Ожидание...");
