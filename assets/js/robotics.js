(function () {
  const page = document.querySelector(".robotics-page");
  if (!page) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".robot-tactile, .robot-tech-card, .delivery-node").forEach((el) => {
    el.addEventListener("pointermove", (event) => {
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--tilt-x", `${(-y * 9).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(x * 11).toFixed(2)}deg`);
      el.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
      el.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    });
  });

  const viewport = document.querySelector(".robot-viewport");
  if (viewport && !reduceMotion) {
    viewport.addEventListener("pointermove", (event) => {
      const rect = viewport.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      viewport.style.setProperty("--scene-x", `${(x * 10).toFixed(2)}deg`);
      viewport.style.setProperty("--scene-y", `${(-y * 8).toFixed(2)}deg`);
    });
    viewport.addEventListener("pointerleave", () => {
      viewport.style.setProperty("--scene-x", "0deg");
      viewport.style.setProperty("--scene-y", "0deg");
    });
  }

  const canvas = document.querySelector(".robot-scan-field");
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    const points = [];
    let width = 0;
    let height = 0;
    let angle = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
      height = canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      points.length = 0;
      for (let i = 0; i < 120; i += 1) {
        points.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          z: Math.random()
        });
      }
    };

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const cx = rect.width * 0.68;
      const cy = rect.height * 0.5;
      angle += 0.018;

      ctx.strokeStyle = "rgba(0, 255, 184, 0.42)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * rect.width * 0.42, cy + Math.sin(angle) * rect.height * 0.42);
      ctx.stroke();

      points.forEach((point) => {
        const pulse = Math.abs(Math.cos(angle + point.z * 5));
        ctx.fillStyle = `rgba(125, 211, 252, ${0.18 + pulse * 0.58})`;
        ctx.fillRect(point.x, point.y, 1.2 + pulse * 2.2, 1.2 + pulse * 2.2);
      });

      requestAnimationFrame(render);
    };

    resize();
    render();
    window.addEventListener("resize", resize);
  }

  if (!reduceMotion) {
    window.addEventListener("scroll", () => {
      document.documentElement.style.setProperty("--robot-scroll", `${window.scrollY * 0.06}px`);
    }, { passive: true });
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  }, { threshold: 0.18 });
  document.querySelectorAll(".reveal-on-scroll").forEach((el) => revealObserver.observe(el));

  const metricObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.target.dataset.done) return;
      entry.target.dataset.done = "true";
      const target = Number(entry.target.dataset.count || 0);
      const output = entry.target.querySelector("strong");
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min(1, (now - start) / 1100);
        output.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.45 });
  document.querySelectorAll(".metric").forEach((el) => metricObserver.observe(el));
})();
