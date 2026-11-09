(() => {
  const $ = (id) => document.getElementById(id);
  const presets = {
    flu: { beta: 0.28, gamma: 0.10, sigma: 0.20, vaccination: 0 },
    covid: { beta: 0.42, gamma: 0.08, sigma: 0.25, vaccination: 40 },
    measles: { beta: 0.72, gamma: 0.12, sigma: 0.35, vaccination: 90 },
    noro: { beta: 0.52, gamma: 0.22, sigma: 0.45, vaccination: 0 },
    custom: null
  };
  const colors = { S: "#111827", E: "#e69f00", I: "#d62728", R: "#00865a", D: "#6b7280" };
  const popCanvas = $("populationCanvas"), popCtx = popCanvas.getContext("2d");
  const chartCanvas = $("chartCanvas"), chartCtx = chartCanvas.getContext("2d");
  let people = [], history = [], running = false, timer = null, step = 0, peak = 0;
  let config = {};

  function readConfig() {
    return {
      population: +$("population").value,
      beta: +$("beta").value,
      vaccination: +$("vaccination").value / 100,
      deathRate: +$("deathRate").value / 100,
      density: $("density").value,
      mixing: $("mixing").value,
      // Fixed teaching-model parameters are preset-specific; these are no longer user controls.
      gamma: (presets[$("preset").value] || presets.flu).gamma,
      sigma: (presets[$("preset").value] || presets.flu).sigma,
    };
  }
  function updateOutputs() {
    const values = {
      population: $("population").value,
      beta: (+$("beta").value).toFixed(2),
      vaccination: `${$("vaccination").value}%`,
      deathRate: `${Number($("deathRate").value).toFixed(2)}%`
    };
    Object.entries(values).forEach(([id, value]) => {
      const outputId = { vaccination: "vaxOut", deathRate: "deathRateOut" }[id] || `${id}Out`;
      $(outputId).textContent = value;
    });
  }
  function applyPreset() {
    const p = presets[$("preset").value];
    if (p) Object.entries(p).forEach(([key, value]) => {
      const el = $(key);
      if (el) el.value = value;
    });
    updateOutputs();
    reset();
  }
  function counts() {
    const c = { S: 0, E: 0, I: 0, R: 0, D: 0 };
    people.forEach(p => c[p.state]++);
    return c;
  }
  function record() {
    const c = counts();
    history.push({ time: step, ...c });
    if (history.length > 2400) history.shift();
    peak = Math.max(peak, c.I);
    $("susceptibleStat").textContent = c.S;
    $("exposedStat").textContent = c.E;
    $("contagiousStat").textContent = c.I;
    $("immuneStat").textContent = c.R;
    $("deathsStat").textContent = `${(100 * c.D / Math.max(1, config.population)).toFixed(1)}% (${c.D} people)`;
    $("peakStat").textContent = peak;

    drawChart();
  }
  function zone() {
    const scale = config.density === "high" ? 0.42 : config.density === "medium" ? 0.70 : 0.98;
    const width = (popCanvas.width - 24) * scale, height = (popCanvas.height - 24) * scale;
    return { left: (popCanvas.width - width) / 2 + 8, right: (popCanvas.width + width) / 2 - 8, top: (popCanvas.height - height) / 2 + 8, bottom: (popCanvas.height + height) / 2 - 8 };
  }
  function reset() {
    pause();
    config = readConfig();
    people = [];
    history = [];
    step = 0;
    peak = 0;
    const n = config.population;
    const vaccinatedN = Math.round(n * config.vaccination);
    const z = zone();
    const speed = config.mixing === "high" ? 2.5 : config.mixing === "medium" ? 1.5 : 0.55;
    for (let i = 0; i < n; i++) {
      people.push({
        x: z.left + Math.random() * (z.right - z.left),
        y: z.top + Math.random() * (z.bottom - z.top),
        vx: (Math.random() - .5) * speed,
        vy: (Math.random() - .5) * speed,
        state: i < vaccinatedN ? "R" : "S",
        days: 0
      });
    }
    const susceptible = people.filter(p => p.state === "S");
    if (susceptible.length) susceptible[0].state = "I";
    if (susceptible.length > 1) susceptible[1].state = "E";
    record();
    drawPopulation();
  }
  function simulateStep() {
    config = readConfig();
    const z = zone();
    const radius = config.density === "high" ? 38 : config.density === "medium" ? 30 : 22;
    const mix = config.mixing === "high" ? 1 : config.mixing === "medium" ? .62 : .28;
    const contactRadius = radius * (config.mixing === "high" ? 1.15 : config.mixing === "low" ? .75 : 1);
    const perContact = Math.min(.95, config.beta * .18);
    const speed = config.mixing === "high" ? 2.5 : config.mixing === "medium" ? 1.5 : .55;
    // Spatial buckets avoid comparing every susceptible person with every contagious person.
    const cellSize = contactRadius;
    const buckets = new Map();
    const key = (x, y) => `${x},${y}`;
    for (const person of people) {
      if (person.state !== "I") continue;
      const cx = Math.floor(person.x / cellSize), cy = Math.floor(person.y / cellSize);
      const k = key(cx, cy);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(person);
    }
    const newExposures = new Set();
    const r2 = contactRadius * contactRadius;
    for (const person of people) {
      if (person.state !== "S") continue;
      const cx = Math.floor(person.x / cellSize), cy = Math.floor(person.y / cellSize);
      let chance = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const inf of (buckets.get(key(cx + dx, cy + dy)) || [])) {
            const ddx = person.x - inf.x, ddy = person.y - inf.y;
            if (ddx * ddx + ddy * ddy <= r2) {
              chance = 1 - (1 - chance) * (1 - perContact * mix);
            }
          }
        }
      }
      if (Math.random() < chance) newExposures.add(person);
    }
    for (const person of people) {
      person.days += 1;
      if (person.state === "E" && Math.random() < config.sigma) person.state = "I";
      else if (person.state === "I" && Math.random() < config.gamma) {
        person.state = Math.random() < config.deathRate ? "D" : "R";
      }
      if (newExposures.has(person)) person.state = "E";
      if (person.state !== "D") {
        if (Math.random() < mix * .20) {
          person.vx = (Math.random() - .5) * speed;
          person.vy = (Math.random() - .5) * speed;
        }
        person.x += person.vx;
        person.y += person.vy;
      }
      if (person.x < z.left || person.x > z.right) person.vx *= -1;
      if (person.y < z.top || person.y > z.bottom) person.vy *= -1;
      person.x = Math.max(z.left, Math.min(z.right, person.x));
      person.y = Math.max(z.top, Math.min(z.bottom, person.y));
    }
    step += 1;
    record();
    drawPopulation();
    if (counts().I === 0 && counts().E === 0) pause();
  }
  function drawPopulation() {
    popCtx.clearRect(0, 0, popCanvas.width, popCanvas.height);
    const z = zone();
    popCtx.strokeStyle = "#dbe6ea"; popCtx.setLineDash([5, 5]); popCtx.strokeRect(z.left, z.top, z.right-z.left, z.bottom-z.top); popCtx.setLineDash([]);
    people.forEach(p => {
      popCtx.beginPath();
      popCtx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      popCtx.fillStyle = colors[p.state];
      popCtx.fill();
    });
  }
  function drawChart() {
    const w = chartCanvas.width, h = chartCanvas.height;
    chartCtx.clearRect(0, 0, w, h);
    const pad = { l: 66, r: 18, t: 24, b: 42 };
    chartCtx.strokeStyle = "#e2e9ec"; chartCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (h - pad.t - pad.b) * i / 4;
      chartCtx.beginPath(); chartCtx.moveTo(pad.l, y); chartCtx.lineTo(w - pad.r, y); chartCtx.stroke();
    }
    chartCtx.fillStyle = "#334155"; chartCtx.font = "14px system-ui";
    chartCtx.save();
    chartCtx.translate(18, h / 2);
    chartCtx.rotate(-Math.PI / 2);
    chartCtx.textAlign = "center";
    chartCtx.fillText("People (individuals)", 0, 0);
    chartCtx.restore();
    chartCtx.textAlign = "right";
    chartCtx.fillText("Time (simulation steps) →", w - 18, h - 10);
    chartCtx.textAlign = "left";
    // Draw the first point immediately so the chart is never blank after Reset.
    if (!history.length) return;
    const maxY = Math.max(10, config.population);
    const xAt = i => pad.l + i / Math.max(1, history.length - 1) * (w - pad.l - pad.r);
    const yAt = val => h - pad.b - val / maxY * (h - pad.t - pad.b);
    ["S", "E", "I", "R", "D"].forEach(state => {
      chartCtx.beginPath(); chartCtx.strokeStyle = colors[state]; chartCtx.lineWidth = 2.5;
      const stride = Math.max(1, Math.ceil(history.length / Math.max(200, w)));
      for (let i = 0; i < history.length; i += stride) {
        const row = history[i];
        if (i === 0) chartCtx.moveTo(xAt(i), yAt(row[state]));
        else chartCtx.lineTo(xAt(i), yAt(row[state]));
      }
      const last = history.length - 1;
      if (last > 0) chartCtx.lineTo(xAt(last), yAt(history[last][state]));
      chartCtx.stroke();
      if (history.length === 1) {
        chartCtx.fillStyle = colors[state];
        chartCtx.beginPath(); chartCtx.arc(xAt(0), yAt(history[0][state]), 4, 0, Math.PI * 2); chartCtx.fill();
      }
    });
  }
  function pause() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
  }
  $("startBtn").addEventListener("click", () => {
    if (running) return;
    running = true;
    timer = setInterval(() => {
      try { simulateStep(); } catch (error) { pause(); console.error("Simulation paused after an error:", error); }
    }, 350);
  });
  $("pauseBtn").addEventListener("click", pause);
  $("resetBtn").addEventListener("click", reset);
  $("csvBtn").addEventListener("click", () => {
    const header = "time,susceptible,exposed,contagious,immune,deaths";
    const rows = history.map(r => [r.time, r.S, r.E, r.I, r.R, r.D].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "disease-dynamics-data.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  ["population", "beta", "vaccination", "deathRate"].forEach(id => {
    $(id).addEventListener("input", updateOutputs);
    $(id).addEventListener("change", reset);
  });
  $("preset").addEventListener("change", applyPreset);
  $("density").addEventListener("change", reset);
  $("mixing").addEventListener("change", reset);
  updateOutputs();
  reset();
})();
