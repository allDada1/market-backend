(function(){
  const drop = document.getElementById("catDrop");
  const btn = document.getElementById("catBtn");

  if (!drop || !btn) return;

  // Mark as wired so js/components/header.js doesn't attach a duplicate handler.
  // Duplicate listeners make the categories dropdown act glitchy.
  try{ drop.dataset.wired = "1"; }catch{}

  function close(){ drop.classList.remove("is-open"); }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    drop.classList.toggle("is-open");
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("#catDrop")) return;
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();