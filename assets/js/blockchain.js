(function () {
  const page = document.querySelector(".blockchain-page");
  if (!page) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".trust-tactile").forEach((el) => {
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

  const stage = document.querySelector(".trust-chain-stage");
  if (stage && !reduceMotion) {
    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      stage.style.setProperty("--chain-x", `${(x * 12).toFixed(2)}deg`);
      stage.style.setProperty("--chain-y", `${(-y * 9).toFixed(2)}deg`);
    });
    stage.addEventListener("pointerleave", () => {
      stage.style.setProperty("--chain-x", "0deg");
      stage.style.setProperty("--chain-y", "0deg");
    });
  }

  const canvas = document.querySelector(".trust-particle-field");
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    const particles = [];
    let angle = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      particles.length = 0;
      for (let i = 0; i < 110; i += 1) {
        particles.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          hue: Math.random() > 0.5 ? "cyan" : "violet"
        });
      }
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      angle += 0.012;

      particles.forEach((point, index) => {
        point.x += point.vx + Math.cos(angle + index) * 0.03;
        point.y += point.vy + Math.sin(angle + index) * 0.03;
        if (point.x < 0 || point.x > rect.width) point.vx *= -1;
        if (point.y < 0 || point.y > rect.height) point.vy *= -1;

        const color = point.hue === "cyan" ? "125, 211, 252" : "168, 85, 247";
        ctx.fillStyle = `rgba(${color}, 0.78)`;
        ctx.fillRect(point.x, point.y, 2, 2);

        for (let i = index + 1; i < particles.length; i += 1) {
          const other = particles[i];
          const dx = point.x - other.x;
          const dy = point.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 96) {
            ctx.strokeStyle = `rgba(${color}, ${0.14 * (1 - distance / 96)})`;
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
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
      const progress = Math.min(1, window.scrollY / Math.max(1, window.innerHeight * 1.2));
      document.documentElement.style.setProperty("--trust-scroll", `${window.scrollY * 0.07}px`);
      document.documentElement.style.setProperty("--chain-progress", progress.toFixed(3));
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
        const progress = Math.min(1, (now - start) / 1200);
        output.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.45 });
  document.querySelectorAll(".metric").forEach((el) => metricObserver.observe(el));
})();
