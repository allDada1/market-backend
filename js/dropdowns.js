// dropdowns.js — click dropdowns (stable), closes on outside click / ESC
(function(){
  // Mark as loaded so js/components/header.js doesn't attach a duplicate handler.
  // Duplicate listeners make dropdowns "toggle twice" (open -> immediately close).
  try{ document.documentElement.dataset.dmDropdowns = "1"; }catch{}

  function closeAll(except){
    document.querySelectorAll(".dropdown.is-open").forEach(d => {
      if (except && d === except) return;
      d.classList.remove("is-open");
    });
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".dropdown__btn");
    const drop = e.target.closest(".dropdown");

    if (btn && drop){
      // toggle this dropdown
      const isOpen = drop.classList.contains("is-open");
      closeAll(drop);
      drop.classList.toggle("is-open", !isOpen);
      return;
    }

    // click inside panel should not close
    if (e.target.closest(".dropdown__panel")) return;

    // outside click -> close all
    closeAll(null);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll(null);
  });
})();
