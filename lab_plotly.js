// Hilfsfunktion: Layout für dunkles Theme
function darkLayout(title, xLabel, yLabel) {
  return {
    title: { text: title, font: { color: '#e5e7eb', size: 14 } },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(15,23,42,1)',
    margin: { l: 50, r: 10, t: 30, b: 40 },
    xaxis: {
      title: xLabel,
      color: '#9ca3af',
      gridcolor: '#1f2937',
      zerolinecolor: '#4b5563'
    },
    yaxis: {
      title: yLabel,
      color: '#9ca3af',
      gridcolor: '#1f2937',
      zerolinecolor: '#4b5563'
    },
    showlegend: true,
    legend: { font: { color: '#e5e7eb', size: 10 } }
  };
}

// ---------------------------------------------------------
// 1. Diodenkennlinie
// ---------------------------------------------------------
function drawDiodeIV() {
  const type = document.getElementById('diodeType').value;

  let Is, n, Vf;
  switch (type) {
    case 'si':  Is = 1e-9;  n = 1.8; Vf = 0.7; break;
    case 'ge':  Is = 5e-6;  n = 1.2; Vf = 0.3; break;
    case 'led': Is = 1e-20; n = 2.0; Vf = 1.8; break;
    case 'zener': Is = 1e-9; n = 1.8; Vf = -5.1; break;
  }

  const Ut = 0.026;
  const x = [];
  const y = [];

  for (let u = -6; u <= 6; u += 0.02) {
    let i;
    if (type === 'zener' && u < Vf) {
      i = (u - Vf) / 5;
    } else if (u >= 0) {
      i = Is * (Math.exp(u / (n * Ut)) - 1);
    } else {
      i = -Is;
    }
    x.push(u);
    y.push(i * 1000);
  }

  const trace = {
    x, y,
    mode: 'lines',
    name: 'I(U)',
    line: { color: '#f97316', width: 2 }
  };

  Plotly.newPlot('ivPlot', [trace],
    darkLayout('Diodenkennlinie', 'Spannung U (V)', 'Strom I (mA)'),
    { displayModeBar: false }
  );
}

// ---------------------------------------------------------
// 2. LED-Vorwiderstand
// ---------------------------------------------------------
function calcLedResistor() {
  const Vs = parseFloat(document.getElementById('ledVs').value);
  const Vf = parseFloat(document.getElementById('ledVf').value);
  const If_mA = parseFloat(document.getElementById('ledIf').value);

  const If = If_mA / 1000;
  const Vr = Vs - Vf;

  if (Vr <= 0 || If <= 0) {
    document.getElementById('ledResult').textContent =
      'Fehler: Versorgungsspannung muss größer als Vf sein.';
    return;
  }

  const R = Vr / If;
  document.getElementById('ledResult').textContent =
    `Benötigter Vorwiderstand: R ≈ ${R.toFixed(0)} Ω\n` +
    `LED‑Strom: ${If_mA.toFixed(0)} mA bei ca. ${Vf.toFixed(2)} V`;
}

// ---------------------------------------------------------
// 3. Gleichrichter + Glättung + Ripple
// ---------------------------------------------------------
function drawRectifier() {
  const type = document.getElementById('rectType').value;
  const Vac = parseFloat(document.getElementById('acAmp').value);
  const f = parseFloat(document.getElementById('acFreq').value);
  const C_uF = parseFloat(document.getElementById('capUf').value);
  const R_k = parseFloat(document.getElementById('loadK').value);

  const C = C_uF * 1e-6;
  const R = R_k * 1000;

  const T = 1 / f;
  const tMax = 3 * T;
  const N = 600;

  const tArr = [];
  const uACArr = [];
  const uRectArr = [];
  const uCArr = [];

  function uAC(t) {
    return Vac * Math.sin(2 * Math.PI * f * t);
  }
  function uRect(t) {
    const u = uAC(t);
    return type === 'half' ? Math.max(0, u) : Math.abs(u);
  }

  let uC = 0;
  let tPrev = 0;
  const dt = tMax / N;

  for (let i = 0; i <= N; i++) {
    const t = i * dt;
    const uInAC = uAC(t);
    const uInRect = uRect(t);

    tArr.push(t * 1000); // ms
    uACArr.push(uInAC);
    uRectArr.push(uInRect);

    if (C > 0 && R > 0) {
      if (uInRect > uC) uC = uInRect;
      else uC = uC * Math.exp(-(t - tPrev) / (R * C));
      uCArr.push(uC);
      tPrev = t;
    }
  }

  const traces = [
    {
      x: tArr,
      y: uACArr,
      mode: 'lines',
      name: 'AC‑Signal',
      line: { color: '#3b82f6', width: 1.5 }
    },
    {
      x: tArr,
      y: uRectArr,
      mode: 'lines',
      name: 'Gleichgerichtet',
      line: { color: '#f97316', width: 1.5 }
    }
  ];

  let ripple = 0;
  if (C > 0 && R > 0) {
    traces.push({
      x: tArr,
      y: uCArr,
      mode: 'lines',
      name: 'Nach Glättung',
      line: { color: '#22c55e', width: 2 }
    });

    const fr = type === 'half' ? f : 2 * f;
    const Iload = Vac / R;
    ripple = Iload / (C * fr);
  }

  Plotly.newPlot('rectPlot', traces,
    darkLayout('Gleichrichter & Glättung', 'Zeit t (ms)', 'Spannung U (V)'),
    { displayModeBar: false }
  );

  document.getElementById('rippleInfo').textContent =
    C > 0 && R > 0
      ? `Ripple‑Spannung ΔU ≈ ${ripple.toFixed(2)} V (Näherung)`
      : 'Kein Glättungskondensator → volle pulsierende Gleichspannung.';
}

// ---------------------------------------------------------
// 4. Zener-Stabilisierung
// ---------------------------------------------------------
function calcZener() {
  const Vin = parseFloat(document.getElementById('vin').value);
  const Vz = parseFloat(document.getElementById('vz').value);
  const Iload_mA = parseFloat(document.getElementById('iload').value);
  const Izmax_mA = parseFloat(document.getElementById('izmax').value);

  const Iload = Iload_mA / 1000;
  const Izmax = Izmax_mA / 1000;

  if (Vin <= Vz) {
    document.getElementById('zenerResult').textContent =
      'Fehler: Vin muss größer als Vz sein.';
    return;
  }

  const Iz_target = 0.5 * Izmax;
  const I_total = Iload + Iz_target;
  const R = (Vin - Vz) / I_total;
  const Iz_noLoad = (Vin - Vz) / R;

  document.getElementById('zenerResult').textContent =
    `Serienwiderstand: R ≈ ${R.toFixed(0)} Ω\n` +
    `Zenerstrom bei Last: ${(Iz_target * 1000).toFixed(1)} mA\n` +
    `Zenerstrom ohne Last: ${(Iz_noLoad * 1000).toFixed(1)} mA`;
}

// Initiale Plots beim Laden
window.addEventListener('load', () => {
  drawDiodeIV();
  calcLedResistor();
  drawRectifier();
  calcZener();
});
