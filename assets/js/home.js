(function () {
  const page = document.querySelector(".home-page");
  if (!page) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".home-tactile").forEach((el) => {
    el.addEventListener("pointermove", (event) => {
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--tilt-x", `${(-y * 10).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(x * 13).toFixed(2)}deg`);
      el.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
      el.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    });
  });

  const visual = document.querySelector(".home-core-visual");
  const hero = document.querySelector(".home-hero");

  if (hero && !reduceMotion) {
    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      hero.style.setProperty("--particle-x", `${(-x * 14).toFixed(2)}px`);
      hero.style.setProperty("--particle-y", `${(-y * 10).toFixed(2)}px`);
    });
    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--particle-x", "0px");
      hero.style.setProperty("--particle-y", "0px");
    });
  }

  if (visual && !reduceMotion) {
    visual.addEventListener("pointermove", (event) => {
      const rect = visual.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      visual.style.setProperty("--home-x", `${(x * 14).toFixed(2)}deg`);
      visual.style.setProperty("--home-y", `${(-y * 11).toFixed(2)}deg`);
    });
    visual.addEventListener("pointerleave", () => {
      visual.style.setProperty("--home-x", "0deg");
      visual.style.setProperty("--home-y", "0deg");
    });
  }

  const canvas = document.querySelector(".home-particle-field");
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    const points = [];
    const streaks = [];
    const pulses = [];
    const pointer = { x: 0, y: 0, active: false };
    let time = 0;
    let cssWidth = 0;
    let cssHeight = 0;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      cssWidth = rect.width;
      cssHeight = rect.height;
      canvas.width = Math.max(1, Math.floor(cssWidth * ratio));
      canvas.height = Math.max(1, Math.floor(cssHeight * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      points.length = 0;
      streaks.length = 0;
      pulses.length = 0;
      const pointCount = Math.min(150, Math.max(72, Math.floor(cssWidth / 9)));
      for (let i = 0; i < pointCount; i += 1) {
        points.push({
          x: Math.random() * cssWidth,
          y: Math.random() * cssHeight,
          vx: (Math.random() - 0.5) * 0.32,
          vy: (Math.random() - 0.5) * 0.32,
          tone: Math.random(),
          r: Math.random() * 1.7 + 0.8,
          depth: Math.random() * 0.85 + 0.35
        });
      }
      for (let i = 0; i < 24; i += 1) {
        streaks.push({
          x: cssWidth * (0.34 + Math.random() * 0.66),
          y: Math.random() * cssHeight,
          length: 50 + Math.random() * 126,
          speed: 0.9 + Math.random() * 1.9,
          tone: Math.random()
        });
      }
      for (let i = 0; i < 4; i += 1) {
        pulses.push({
          x: cssWidth * (0.54 + Math.random() * 0.34),
          y: cssHeight * (0.24 + Math.random() * 0.54),
          radius: 24 + Math.random() * 72,
          speed: 0.45 + Math.random() * 0.34,
          alpha: 0.28 + Math.random() * 0.18
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      time += 0.012;
      frame += 1;

      const scan = ctx.createLinearGradient(cssWidth * 0.46, 0, cssWidth, cssHeight);
      scan.addColorStop(0, "rgba(125, 211, 252, 0)");
      scan.addColorStop(0.45, "rgba(125, 211, 252, 0.035)");
      scan.addColorStop(0.5, "rgba(0, 255, 184, 0.16)");
      scan.addColorStop(0.55, "rgba(125, 211, 252, 0.035)");
      scan.addColorStop(1, "rgba(125, 211, 252, 0)");
      ctx.save();
      ctx.translate(Math.sin(time * 0.9) * 80, 0);
      ctx.fillStyle = scan;
      ctx.fillRect(cssWidth * 0.28, 0, cssWidth * 0.86, cssHeight);
      ctx.restore();

      points.forEach((point, index) => {
        let forceX = 0;
        let forceY = 0;
        if (pointer.active) {
          const dx = point.x - pointer.x;
          const dy = point.y - pointer.y;
          const distance = Math.max(24, Math.hypot(dx, dy));
          if (distance < 210) {
            const pull = (1 - distance / 210) * 0.018 * point.depth;
            forceX -= dx * pull;
            forceY -= dy * pull;
          }
        }

        point.x += point.vx + Math.cos(time + index) * 0.03 * point.depth + forceX;
        point.y += point.vy + Math.sin(time * 1.3 + index) * 0.03 * point.depth + forceY;
        if (point.x < -12) point.x = cssWidth + 12;
        if (point.x > cssWidth + 12) point.x = -12;
        if (point.y < -12) point.y = cssHeight + 12;
        if (point.y > cssHeight + 12) point.y = -12;

        const color = point.tone > 0.65 ? "0, 255, 184" : point.tone > 0.32 ? "125, 211, 252" : "168, 85, 247";
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color}, ${0.42 + point.depth * 0.34})`;
        ctx.arc(point.x, point.y, point.r * point.depth, 0, Math.PI * 2);
        ctx.fill();

        for (let i = index + 1; i < points.length; i += 1) {
          const other = points[i];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance < 136) {
            const opacity = 0.17 * (1 - distance / 136) * Math.min(point.depth, other.depth);
            ctx.strokeStyle = `rgba(${color}, ${opacity})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      });

      streaks.forEach((streak) => {
        streak.x += streak.speed;
        if (streak.x - streak.length > cssWidth) {
          streak.x = cssWidth * (0.34 + Math.random() * 0.12);
          streak.y = Math.random() * cssHeight;
        }
        const color = streak.tone > 0.5 ? "125, 211, 252" : "0, 255, 184";
        const gradient = ctx.createLinearGradient(streak.x - streak.length, streak.y, streak.x, streak.y);
        gradient.addColorStop(0, `rgba(${color}, 0)`);
        gradient.addColorStop(1, `rgba(${color}, 0.48)`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(streak.x - streak.length, streak.y);
        ctx.lineTo(streak.x, streak.y + Math.sin(time + streak.y) * 8);
        ctx.stroke();
      });

      pulses.forEach((pulse) => {
        pulse.radius += pulse.speed;
        if (pulse.radius > Math.min(cssWidth, cssHeight) * 0.42) {
          pulse.radius = 18;
          pulse.x = cssWidth * (0.54 + Math.random() * 0.34);
          pulse.y = cssHeight * (0.22 + Math.random() * 0.56);
        }
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 255, 184, ${pulse.alpha * (1 - pulse.radius / (Math.min(cssWidth, cssHeight) * 0.45))})`;
        ctx.lineWidth = 1;
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      requestAnimationFrame(draw);
    };

    canvas.addEventListener("pointermove", (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    });
    canvas.addEventListener("pointerleave", () => {
      pointer.active = false;
    });

    resize();
    draw();
    window.addEventListener("resize", resize);
  }

  if (!reduceMotion) {
    window.addEventListener("scroll", () => {
      document.documentElement.style.setProperty("--home-scroll", `${window.scrollY * 0.07}px`);
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
