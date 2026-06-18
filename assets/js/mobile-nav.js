(() => {
  const header = document.querySelector(".site-header");
  const nav = header?.querySelector(".site-nav");

  if (!header || !nav) return;

  const navId = nav.id || "site-navigation";
  nav.id = navId;
  header.classList.add("has-mobile-nav");

  const toggle = document.createElement("button");
  toggle.className = "nav-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-controls", navId);
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "打开导航菜单");
  toggle.innerHTML = '<span></span><span></span><span></span>';
  header.insertBefore(toggle, nav);

  const closeMenu = () => {
    header.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "打开导航菜单");
  };

  toggle.addEventListener("click", () => {
    const willOpen = !header.classList.contains("nav-open");
    header.classList.toggle("nav-open", willOpen);
    toggle.setAttribute("aria-expanded", String(willOpen));
    toggle.setAttribute("aria-label", willOpen ? "关闭导航菜单" : "打开导航菜单");
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
      toggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMenu();
  });
})();
