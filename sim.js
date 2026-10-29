(() => {
  const $ = (id) => document.getElementById(id);
  const presets = {
    flu: { beta: 0.28, gamma: 0.10, sigma: 0.20, vaccination: 20, mask: 20 },
    covid: { beta: 0.42, gamma: 0.08, sigma: 0.25, vaccination: 35, mask: 20 },
    measles: { beta: 0.72, gamma: 0.12, sigma: 0.35, vaccination: 85, mask: 10 },
    noro: { beta: 0.52, gamma: 0.22, sigma: 0.45, vaccination: 0, mask: 10 },
    custom: null
  };
  const colors = { S: "#7e9ca8", E: "#e8b44c", I: "#d95d59", R: "#3b9b7a" };
  const popCanvas = $("populationCanvas"), popCtx = popCanvas.getContext("2d");
  const chartCanvas = $("chartCanvas"), chartCtx = chartCanvas.getContext("2d");
  let people = [], history = [], running = false, timer = null, step = 0, peak = 0;
  let config = {};

  function readConfig() {
    return {
      population: +$("population").value,
      beta: +$("beta").value,
      gamma: +$("gamma").value,
      sigma: +$("sigma").value,
      vaccination: +$("vaccination").value / 100,
      mask: +$("mask").value / 100,
      density: $("density").value,
      mixing: $("mixing").value,
      modelType: $("modelType").value
    };
  }
  function updateOutputs() {
    ["population", "beta", "gamma", "sigma", "vaccination", "mask"].forEach(id => {
      const val = +$(id).value;
      const display = id === "vaccination" || id === "mask" ? `${val}%` : (id === "population" ? val : val.toFixed(2));
      $(id + "Out").textContent = display;
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
    const c = { S: 0, E: 0, I: 0, R: 0 };
    people.forEach(p => c[p.state]++);
    return c;
  }
  function record() {
    const c = counts();
    history.push({ time: step, ...c });
    peak = Math.max(peak, c.I);
    $("susceptibleStat").textContent = c.S;
    $("exposedStat").textContent = c.E;
    $("infectiousStat").textContent = c.I;
    $("recoveredStat").textContent = c.R;
    $("peakStat").textContent = peak;
    const contactAdjustedBeta = config.beta * (1 - config.mask);
    const mixingMultiplier = config.mixing === "high" ? 1 : config.mixing === "medium" ? .62 : .28;
    $("r0Stat").textContent = (contactAdjustedBeta * mixingMultiplier / config.gamma).toFixed(2);
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
    if (config.modelType === "SEIR" && susceptible.length > 1) susceptible[1].state = "E";
    record();
    drawPopulation();
  }
  function simulateStep() {
    config = readConfig();
    const infectious = people.filter(p => p.state === "I");
    const z = zone();
    const radius = config.density === "high" ? 38 : config.density === "medium" ? 30 : 22;
    const mix = config.mixing === "high" ? 1 : config.mixing === "medium" ? .62 : .28;
    const contactRadius = radius * (config.mixing === "high" ? 1.15 : config.mixing === "low" ? .75 : 1);
    const perContact = Math.min(.95, config.beta * (1 - config.mask) * .18);
    const speed = config.mixing === "high" ? 2.5 : config.mixing === "medium" ? 1.5 : .55;
    people.forEach(p => {
      p.days += 1;
      if (p.state === "S") {
        let chance = 0;
        for (const inf of infectious) {
          const dx = p.x - inf.x, dy = p.y - inf.y;
          if (dx * dx + dy * dy <= contactRadius * contactRadius) chance = 1 - (1 - chance) * (1 - perContact * mix);
        }
        if (Math.random() < chance) p.state = config.modelType === "SEIR" ? "E" : "I";
      } else if (p.state === "E" && Math.random() < config.sigma) p.state = "I";
      else if (p.state === "I" && Math.random() < config.gamma) p.state = "R";
      if (Math.random() < mix * .20) { p.vx = (Math.random() - .5) * speed; p.vy = (Math.random() - .5) * speed; }
      p.x += p.vx; p.y += p.vy;
      if (p.x < z.left || p.x > z.right) p.vx *= -1;
      if (p.y < z.top || p.y > z.bottom) p.vy *= -1;
      p.x = Math.max(z.left, Math.min(z.right, p.x));
      p.y = Math.max(z.top, Math.min(z.bottom, p.y));
    });
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
      popCtx.arc(p.x, p.y, 4.2, 0, Math.PI * 2);
      popCtx.fillStyle = colors[p.state];
      popCtx.fill();
    });
  }
  function drawChart() {
    const w = chartCanvas.width, h = chartCanvas.height;
    chartCtx.clearRect(0, 0, w, h);
    const pad = { l: 42, r: 16, t: 18, b: 32 };
    chartCtx.strokeStyle = "#e2e9ec"; chartCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (h - pad.t - pad.b) * i / 4;
      chartCtx.beginPath(); chartCtx.moveTo(pad.l, y); chartCtx.lineTo(w - pad.r, y); chartCtx.stroke();
    }
    chartCtx.fillStyle = "#607483"; chartCtx.font = "12px system-ui";
    chartCtx.fillText("People", 8, 14); chartCtx.fillText("Time →", w - 58, h - 8);
    if (history.length < 2) return;
    const maxY = Math.max(10, config.population);
    const xAt = i => pad.l + i / Math.max(1, history.length - 1) * (w - pad.l - pad.r);
    const yAt = val => h - pad.b - val / maxY * (h - pad.t - pad.b);
    ["S", "E", "I", "R"].forEach(state => {
      chartCtx.beginPath(); chartCtx.strokeStyle = colors[state]; chartCtx.lineWidth = 2.5;
      history.forEach((row, i) => i === 0 ? chartCtx.moveTo(xAt(i), yAt(row[state])) : chartCtx.lineTo(xAt(i), yAt(row[state])));
      chartCtx.stroke();
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
    timer = setInterval(simulateStep, 350);
  });
  $("pauseBtn").addEventListener("click", pause);
  $("resetBtn").addEventListener("click", reset);
  $("csvBtn").addEventListener("click", () => {
    const header = "time,susceptible,exposed,infectious,recovered_or_immune";
    const rows = history.map(r => [r.time, r.S, r.E, r.I, r.R].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "disease-dynamics-data.csv"; a.click();
    URL.revokeObjectURL(url);
  });
  ["population", "beta", "gamma", "sigma", "vaccination", "mask"].forEach(id => $(id).addEventListener("input", updateOutputs));
  $("preset").addEventListener("change", applyPreset);
  $("modelType").addEventListener("change", reset);
  $("density").addEventListener("change", reset);
  $("mixing").addEventListener("change", reset);
  updateOutputs();
  reset();
})();
