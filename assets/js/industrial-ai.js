(function () {
  const page = document.querySelector(".industrial-page");
  if (!page) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.querySelector(".particle-field");
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    let particles = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
      height = canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      particles = Array.from({ length: Math.min(90, Math.floor(rect.width / 14)) }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 0.4
      }));
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "rgba(125, 211, 252, 0.72)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.16)";

      particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > rect.width) p.vx *= -1;
        if (p.y < 0 || p.y > rect.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        for (let i = index + 1; i < particles.length; i += 1) {
          const other = particles[i];
          const dx = p.x - other.x;
          const dy = p.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 120) {
            ctx.globalAlpha = 1 - distance / 120;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      });

      requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
  }

  if (!reduceMotion) {
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      document.documentElement.style.setProperty("--scroll-y", `${y * 0.08}px`);
    }, { passive: true });
  }

  document.querySelectorAll(".tactile-card, .tactile-btn").forEach((el) => {
    el.addEventListener("pointermove", (event) => {
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--tilt-x", `${(-y * 8).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(x * 10).toFixed(2)}deg`);
      el.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
      el.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    });
  });

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
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / 1200);
        output.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.45 });

  document.querySelectorAll(".metric").forEach((el) => metricObserver.observe(el));
})();
