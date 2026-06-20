(function () {
  const page = document.querySelector(".join-page");
  if (!page) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".join-tactile").forEach((el) => {
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

  const orbit = document.querySelector(".join-orbit");
  if (orbit && !reduceMotion) {
    orbit.addEventListener("pointermove", (event) => {
      const rect = orbit.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      orbit.style.setProperty("--join-x", `${(x * 12).toFixed(2)}deg`);
      orbit.style.setProperty("--join-y", `${(-y * 9).toFixed(2)}deg`);
    });
    orbit.addEventListener("pointerleave", () => {
      orbit.style.setProperty("--join-x", "0deg");
      orbit.style.setProperty("--join-y", "0deg");
    });
  }

  const canvas = document.querySelector(".join-particle-field");
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    const points = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      points.length = 0;
      for (let i = 0; i < 92; i += 1) {
        points.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          vx: (Math.random() - 0.5) * 0.26,
          vy: (Math.random() - 0.5) * 0.26
        });
      }
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      points.forEach((point, index) => {
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < 0 || point.x > rect.width) point.vx *= -1;
        if (point.y < 0 || point.y > rect.height) point.vy *= -1;
        ctx.fillStyle = "rgba(125, 211, 252, 0.78)";
        ctx.fillRect(point.x, point.y, 2, 2);
        for (let i = index + 1; i < points.length; i += 1) {
          const other = points[i];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance < 105) {
            ctx.strokeStyle = `rgba(125, 211, 252, ${0.13 * (1 - distance / 105)})`;
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

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  }, { threshold: 0.18 });
  document.querySelectorAll(".reveal-on-scroll").forEach((el) => revealObserver.observe(el));
})();
