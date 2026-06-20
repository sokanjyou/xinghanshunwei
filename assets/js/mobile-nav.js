(() => {
  const root = document.documentElement;
  const mobileViewport = window.matchMedia("(max-width: 1100px)");
  const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)");
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

  const hasMobileDeviceFeatures = () => {
    const userAgentDataMobile = navigator.userAgentData?.mobile === true;
    const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    return userAgentDataMobile || mobileUserAgent.test(navigator.userAgent) || (touchCapable && coarsePointer.matches);
  };

  const isMobileUi = () => mobileViewport.matches && hasMobileDeviceFeatures();
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
    root.classList.remove("mobile-nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "打开导航菜单");
  };

  const syncMobileUi = () => {
    const enabled = isMobileUi();
    root.classList.toggle("mobile-ui", enabled);
    if (!enabled) closeMenu();
  };

  toggle.addEventListener("click", () => {
    if (!root.classList.contains("mobile-ui")) return;
    const willOpen = !header.classList.contains("nav-open");
    header.classList.toggle("nav-open", willOpen);
    root.classList.toggle("mobile-nav-open", willOpen);
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
    if (event.key === "Escape" && header.classList.contains("nav-open")) {
      closeMenu();
      toggle.focus();
    }
  });

  mobileViewport.addEventListener?.("change", syncMobileUi);
  coarsePointer.addEventListener?.("change", syncMobileUi);
  window.addEventListener("orientationchange", syncMobileUi);
  syncMobileUi();
})();
