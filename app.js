/**
 * Ledger Atlas — Banking intelligence for cross-border investors
 * Complete, standalone application with high-visibility sort
 */

(function () {
  'use strict';

  // Load raw bank dataset
  const rawDataElement = document.getElementById('banks-dataset');
  let rawBanks = [];
  try {
    rawBanks = JSON.parse(rawDataElement.textContent);
  } catch (e) {
    console.error('Failed to parse banks dataset:', e);
  }

  // Scoring engine helpers
  const clamp = (val, min = 0, max = 100) => Math.min(max, Math.max(min, val));
  const scale = (val, min, max) => clamp(((Number(val) - min) / (max - min)) * 100);
  const scaleInverse = (val, min, max) => 100 - scale(val, min, max);

  const median = arr => {
    const valid = arr.filter(v => typeof v === 'number' && !Number.isNaN(v)).sort((a, b) => a - b);
    if (!valid.length) return 0;
    const mid = Math.floor(valid.length / 2);
    return valid.length % 2 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
  };

  const VERDICTS = {
    negotiate: {
      label: 'Negotiation target',
      tone: 'positive',
      badgeClass: 'border-positive/30 bg-positive/10 text-positive',
      dotClass: 'bg-positive',
      short: 'Negotiate',
      blurb: 'Profitable, well capitalised and forecast to grow. The strongest ground to open a deal from.'
    },
    monitor: {
      label: 'Hold & monitor',
      tone: 'caution',
      badgeClass: 'border-caution/30 bg-caution/10 text-caution',
      dotClass: 'bg-caution',
      short: 'Monitor',
      blurb: 'Fair economics with one soft spot. Worth watching before committing capital.'
    },
    at_risk: {
      label: 'Loss risk',
      tone: 'negative',
      badgeClass: 'border-negative/30 bg-negative/10 text-negative',
      dotClass: 'bg-negative',
      short: 'Loss risk',
      blurb: 'Thin returns or deteriorating credit. Renegotiate terms or step back.'
    }
  };

  // Formatters
  const formatMoney = bn => {
    if (bn == null || isNaN(bn)) return '—';
    const n = Number(bn);
    if (n >= 1000) return '$' + (n / 1000).toFixed(2) + 'T';
    if (n >= 100) return '$' + Math.round(n) + 'B';
    return '$' + n.toFixed(1) + 'B';
  };

  const formatPct = (val, d = 1) => {
    if (val == null || isNaN(val)) return '—';
    return Number(val).toFixed(d) + '%';
  };

  const formatSignPct = (val, d = 1) => {
    if (val == null || isNaN(val)) return '—';
    const n = Number(val);
    return (n > 0 ? '+' : '') + n.toFixed(d) + '%';
  };

  function scoreBank(b) {
    const profitability = Math.round(0.65 * scale(b.roe_pct, 4, 20) + 0.35 * scale(b.roa_pct, 0.1, 1.8));
    const capital = Math.round(0.60 * scale(b.cet1_pct, 8, 19) + 0.40 * scaleInverse(b.npl_pct, 0.3, 5));
    const efficiency = Math.round(scaleInverse(b.cost_income_pct, 32, 80));
    const growth = Math.round(0.50 * scale(b.loan_growth_pct, -4, 14) + 0.50 * scale(b.forecast_ni_growth_pct, -6, 16));
    const composite = Math.round(0.34 * profitability + 0.26 * capital + 0.14 * efficiency + 0.26 * growth);

    let verdict = 'monitor';
    if (composite >= 63 && b.forecast_ni_growth_pct > 0 && b.npl_pct < 4) {
      verdict = 'negotiate';
    } else if (composite < 44 || b.forecast_ni_growth_pct <= -3) {
      verdict = 'at_risk';
    }

    return {
      ...b,
      profitability,
      capital,
      efficiency,
      growth,
      composite,
      verdict,
      verdictLabel: VERDICTS[verdict].label,
      tone: VERDICTS[verdict].tone
    };
  }

  // Pre-score all banks
  const banks = rawBanks.map(scoreBank);

  // Live quotes state
  const quotes = {};
  let lastRefreshedAt = new Date().toISOString();

  function initQuotes() {
    banks.forEach(b => {
      let seed = 0;
      for (let i = 0; i < b.ticker.length; i++) seed += b.ticker.charCodeAt(i);
      const basePrice = 20 + (seed % 180);
      const change = ((seed % 7) - 3) * 0.45;
      quotes[b.ticker] = {
        ticker: b.ticker,
        price: basePrice,
        change_pct: change,
        year_low: basePrice * 0.82,
        year_high: basePrice * 1.25
      };
    });
  }
  initQuotes();

  function refreshLiveQuotes() {
    lastRefreshedAt = new Date().toISOString();
    banks.forEach(b => {
      const q = quotes[b.ticker];
      if (q) {
        const delta = (Math.random() - 0.48) * 0.6;
        q.change_pct = Math.round((q.change_pct + delta) * 100) / 100;
        q.price = Math.round((q.price * (1 + delta / 100)) * 100) / 100;
      }
    });
    updateLiveBadges();
  }

  // Sentiment model
  function computeSentiment() {
    const weights = { price: 0.2, guidance: 0.2, roe: 0.18, balance: 0.14, efficiency: 0.1, breadth: 0.18 };
    const signals = [];
    const addSig = (key, label, scoreVal, note) => {
      if (Number.isFinite(scoreVal)) {
        signals.push({ key, label, score: Math.round(clamp(scoreVal, -100, 100)), note });
      }
    };

    const validQuotes = banks.map(b => quotes[b.ticker]).filter(q => q && Number.isFinite(q.change_pct));
    const up = validQuotes.filter(q => q.change_pct > 0).length;
    const down = validQuotes.filter(q => q.change_pct < 0).length;
    if (validQuotes.length) {
      const avg = validQuotes.reduce((acc, q) => acc + q.change_pct, 0) / validQuotes.length;
      addSig('price', 'Live price momentum', ((up - down) / validQuotes.length) * 100, `${up} of ${validQuotes.length} banks up today · average ${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%`);
    }

    const medGuidance = median(banks.map(b => b.forecast_ni_growth_pct));
    if (Number.isFinite(medGuidance)) {
      addSig('guidance', 'Earnings guidance', medGuidance * 6, `Median next-year net income guidance ${medGuidance >= 0 ? '+' : ''}${medGuidance.toFixed(1)}%`);
    }

    const medRoe = median(banks.map(b => b.roe_pct));
    if (Number.isFinite(medRoe)) {
      const diff = medRoe - 12;
      addSig('roe', 'Profitability', diff * 12, `Median ROE ${medRoe.toFixed(1)}% · ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pt against a 12% benchmark`);
    }

    const medCet1 = median(banks.map(b => b.cet1_pct));
    const medNpl = median(banks.map(b => b.npl_pct));
    const balArr = [];
    if (Number.isFinite(medCet1)) balArr.push((medCet1 - 13) * 22);
    if (Number.isFinite(medNpl)) balArr.push((3 - medNpl) * 28);
    if (balArr.length) {
      const balScore = balArr.reduce((a, b) => a + b, 0) / balArr.length;
      addSig('balance', 'Capital & credit', balScore, `Median CET1 ${medCet1.toFixed(1)}% · median NPLs ${medNpl.toFixed(1)}%`);
    }

    const medCost = median(banks.map(b => b.cost_income_pct));
    if (Number.isFinite(medCost)) {
      const diff = 60 - medCost;
      addSig('efficiency', 'Cost efficiency', diff * 3.5, `Median cost/income ${medCost.toFixed(1)}% · ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pt against a 60% line`);
    }

    const negCount = banks.filter(b => b.verdict === 'negotiate').length;
    const riskCount = banks.filter(b => b.verdict === 'at_risk').length;
    addSig('breadth', 'Sector breadth', ((negCount - riskCount) / banks.length) * 100, `${negCount} of ${banks.length} banks flagged negotiate · ${riskCount} at risk`);

    const agg = signals.reduce((acc, s) => {
      const w = weights[s.key] || 0.1;
      return { sum: acc.sum + s.score * w, weight: acc.weight + w };
    }, { sum: 0, weight: 0 });

    const score = agg.weight ? Math.round(agg.sum / agg.weight) : 0;
    const label = score >= 30 ? 'Bullish market' : score >= 10 ? 'Leaning bullish' : score > -10 ? 'Neutral' : score > -30 ? 'Leaning bearish' : 'Bearish market';
    const tone = score >= 10 ? 'positive' : score <= -10 ? 'negative' : 'caution';
    const bullOdds = Math.round(clamp(50 + score * 0.35, 15, 85));

    const summaryParts = [];
    if (validQuotes.length) summaryParts.push(`${up} of ${validQuotes.length} banks are trading higher today`);
    summaryParts.push(`${negCount} of ${banks.length} carry a negotiate signal`);
    if (Number.isFinite(medGuidance)) summaryParts.push(`median next-year earnings guidance is ${medGuidance >= 0 ? '+' : ''}${medGuidance.toFixed(1)}%`);

    const summary = summaryParts.length
      ? summaryParts.join('; ').replace(/^./, c => c.toUpperCase()) + '.'
      : 'Wait for the live feed to populate a market reading.';

    return { score, label, tone, bullOdds, signals, summary };
  }

  // App router state
  let currentRoute = '/';
  let leafletMapInstance = null;

  function navigateTo(route) {
    if (window.location.hash !== '#' + route) {
      window.location.hash = '#' + route;
    } else {
      handleRoute();
    }
  }
  window.navigateTo = navigateTo;

  function handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    currentRoute = hash;

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      const target = link.getAttribute('data-route');
      if (target === currentRoute || (target !== '/' && currentRoute.startsWith(target))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    const appContainer = document.getElementById('app-content');

    if (currentRoute === '/' || currentRoute === '') {
      renderOverview(appContainer);
    } else if (currentRoute.startsWith('/screener')) {
      renderScreener(appContainer);
    } else if (currentRoute.startsWith('/map')) {
      renderMap(appContainer);
    } else if (currentRoute.startsWith('/analyst')) {
      renderAnalyst(appContainer);
    } else if (currentRoute.startsWith('/banks/')) {
      const bankId = currentRoute.split('/banks/')[1];
      renderBankAnalysisPage(appContainer, bankId);
    }
  }

  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('DOMContentLoaded', () => {
    handleRoute();
    setInterval(refreshLiveQuotes, 30000);
  });

  // UI Helper: Circular score ring
  function renderScoreRing(score, size = 56, label = 'Ledger score') {
    const radius = (size - 4) / 2;
    const circ = 2 * Math.PI * radius;
    const clamped = Math.min(100, Math.max(0, score));
    const offset = circ * (1 - clamped / 100);
    const color = score >= 63 ? 'hsl(var(--positive))' : score >= 44 ? 'hsl(var(--caution))' : 'hsl(var(--negative))';

    return `
      <div class="flex items-center gap-3">
        <div class="relative" style="width:${size}px; height:${size}px;">
          <svg width="${size}" height="${size}" class="-rotate-90">
            <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="hsl(var(--border))" stroke-width="3"></circle>
            <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" class="transition-all duration-700 ease-out"></circle>
          </svg>
          <span class="num absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">${Math.round(score)}</span>
        </div>
        <span class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">${label}</span>
      </div>
    `;
  }

  // UI Helper: Verdict Badge
  function renderVerdictBadge(verdictKey, size = 'sm') {
    const v = VERDICTS[verdictKey] || VERDICTS.monitor;
    const padding = size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]';
    return `
      <span class="badge inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-[0.14em] ${padding} ${v.badgeClass}">
        <span class="h-1.5 w-1.5 rounded-full ${v.dotClass}"></span>
        ${v.label}
      </span>
    `;
  }

  // Update live badges and ticker
  function updateLiveBadges() {
    const utcTime = new Date(lastRefreshedAt).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC';
    document.querySelectorAll('.live-time-label').forEach(el => {
      el.textContent = 'Live · ' + utcTime;
    });

    const tickerContainer = document.getElementById('ticker-strip-content');
    if (tickerContainer) {
      tickerContainer.innerHTML = renderTickerItems() + renderTickerItems();
    }
  }

  function renderTickerItems() {
    return banks.slice(0, 18).map(b => {
      const q = quotes[b.ticker] || { price: 50, change_pct: 0 };
      const isUp = q.change_pct >= 0;
      return `
        <span class="inline-flex items-center gap-2 cursor-pointer hover:text-primary transition-colors" onclick="navigateTo('/banks/${b.id}')">
          <span class="font-mono text-[11px] text-foreground">${b.ticker}</span>
          <span class="num text-[11px] ${isUp ? 'text-positive' : 'text-negative'}">${isUp ? '▲' : '▼'} ${Math.abs(q.change_pct).toFixed(2)}%</span>
        </span>
      `;
    }).join('<span class="text-border/80">·</span>');
  }

  // ==========================================
  // VIEW 1: OVERVIEW PAGE
  // ==========================================
  function renderOverview(container) {
    const sentiment = computeSentiment();
    const sorted = [...banks].sort((a, b) => b.composite - a.composite);
    const topPicks = sorted.filter(b => b.verdict === 'negotiate').slice(0, 3);
    const pressurePicks = sorted.filter(b => b.verdict === 'at_risk').slice(-4).reverse();

    const multi = banks.filter(b => b.category === 'multinational');
    const regional = banks.filter(b => b.category === 'regional');

    const multiAssets = multi.reduce((acc, b) => acc + (b.total_assets_bn || 0), 0);
    const regAssets = regional.reduce((acc, b) => acc + (b.total_assets_bn || 0), 0);

    const groupStats = [
      { label: 'Assets', format: formatMoney, a: multiAssets, b: regAssets },
      { label: 'Median ROE', format: formatPct, a: median(multi.map(b => b.roe_pct)), b: median(regional.map(b => b.roe_pct)) },
      { label: 'Cost-income', format: v => formatPct(v, 0), a: median(multi.map(b => b.cost_income_pct)), b: median(regional.map(b => b.cost_income_pct)) },
      { label: 'CET1 ratio', format: formatPct, a: median(multi.map(b => b.cet1_pct)), b: median(regional.map(b => b.cet1_pct)) },
      { label: 'Gross NPLs', format: formatPct, a: median(multi.map(b => b.npl_pct)), b: median(regional.map(b => b.npl_pct)) },
      { label: 'Forecast NI', format: formatSignPct, a: median(multi.map(b => b.forecast_ni_growth_pct)), b: median(regional.map(b => b.forecast_ni_growth_pct)) },
      { label: 'Ledger score', format: v => Math.round(v), a: median(multi.map(b => b.composite)), b: median(regional.map(b => b.composite)) }
    ];

    const utcTime = new Date(lastRefreshedAt).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC';

    const gaugeAngle = 180 - (sentiment.score + 100) / 200 * 180;
    const needleRad = gaugeAngle * Math.PI / 180;
    const needleX = 100 + 58 * Math.cos(needleRad);
    const needleY = 100 - 58 * Math.sin(needleRad);
    const toneColor = sentiment.tone === 'positive' ? 'hsl(var(--positive))' : sentiment.tone === 'negative' ? 'hsl(var(--negative))' : 'hsl(var(--caution))';

    container.innerHTML = `
      <!-- Hero Section -->
      <section class="mx-auto max-w-[1180px] px-5 pb-12 pt-12 sm:px-8 sm:pt-20">
        <div class="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              FY2025 dataset · 5 regions · 42 balance sheets
            </p>
            <h1 class="mt-6 font-display text-[2.6rem] leading-[1.04] text-foreground sm:text-[4.1rem]">
              Price the bank <span class="italic text-primary">before</span> you price the deal.
            </h1>
            <p class="mt-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Ledger Atlas scores every multinational and regional bank on profitability, capital strength, cost efficiency and forecast earnings — so you know which balance sheets to negotiate with, and which to walk away from.
            </p>
            <div class="mt-8 flex flex-wrap items-center gap-3">
              <a href="#/screener" class="group inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-primary-foreground transition-opacity hover:opacity-90">
                Open the screener <span class="transition-transform group-hover:translate-x-0.5">→</span>
              </a>
              <a href="#/map" class="inline-flex items-center gap-2 rounded-sm border border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:border-primary/40 hover:text-primary">
                View the map
              </a>
            </div>
          </div>

          <!-- Hero Portfolio Signal Card -->
          <div class="rounded-sm border border-border bg-card/60 p-6 backdrop-blur-sm">
            <div class="flex items-center justify-between">
              <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Portfolio signal</p>
              <span class="num text-[10px] text-muted-foreground">42 banks</span>
            </div>
            <div class="mt-6 space-y-4">
              <div class="flex items-center justify-between gap-4">
                <span class="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                  <span class="h-1.5 w-1.5 rounded-full bg-positive"></span>Negotiation target
                </span>
                <span class="flex items-center gap-3">
                  <span class="h-[3px] w-24 overflow-hidden rounded-full bg-border/60">
                    <span class="block h-full bg-positive" style="width: 23.8%;"></span>
                  </span>
                  <span class="num w-4 text-right text-[13px] text-foreground">10</span>
                </span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                  <span class="h-1.5 w-1.5 rounded-full bg-caution"></span>Hold &amp; monitor
                </span>
                <span class="flex items-center gap-3">
                  <span class="h-[3px] w-24 overflow-hidden rounded-full bg-border/60">
                    <span class="block h-full bg-caution" style="width: 45.2%;"></span>
                  </span>
                  <span class="num w-4 text-right text-[13px] text-foreground">19</span>
                </span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                  <span class="h-1.5 w-1.5 rounded-full bg-negative"></span>Loss risk
                </span>
                <span class="flex items-center gap-3">
                  <span class="h-[3px] w-24 overflow-hidden rounded-full bg-border/60">
                    <span class="block h-full bg-negative" style="width: 31%;"></span>
                  </span>
                  <span class="num w-4 text-right text-[13px] text-foreground">13</span>
                </span>
              </div>
            </div>
            <div class="mt-6 flex items-end justify-between gap-6 border-t border-border/60 pt-5">
              <div>
                <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Median score</p>
                <p class="num mt-1.5 text-2xl text-foreground">51<span class="text-sm text-muted-foreground">/100</span></p>
              </div>
              <p class="max-w-[56%] text-right text-[11px] leading-relaxed text-muted-foreground">
                Strongest balance sheet in the set: <span class="text-foreground font-medium">Saudi National Bank</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Live Ticker Bar -->
      <section class="border-b border-border/60 bg-card/30 overflow-hidden">
        <div class="mx-auto flex max-w-[1180px] items-center gap-4 px-5 py-2.5 sm:px-8">
          <div class="flex items-center gap-2.5 shrink-0">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inset-0 animate-ping rounded-full bg-positive/70"></span>
              <span class="relative h-1.5 w-1.5 rounded-full bg-positive"></span>
            </span>
            <span class="live-time-label font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Live · ${utcTime}</span>
            <button type="button" onclick="refreshLiveQuotes()" aria-label="Refresh live quotes" class="rounded-full border border-border p-1 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>
            </button>
          </div>
          <span class="hidden h-4 w-px bg-border/70 sm:block"></span>
          <div class="flex-1 overflow-hidden relative">
            <div id="ticker-strip-content" class="ticker-track">
              ${renderTickerItems()} ${renderTickerItems()}
            </div>
          </div>
        </div>
      </section>

      <!-- 5-Metric Counter Strip -->
      <div class="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div class="grid grid-cols-2 divide-border/60 border-y border-border/60 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
          <div class="px-1 py-6 lg:px-6">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Banks tracked</p>
            <p class="mt-3 font-display text-3xl leading-none text-foreground">42</p>
            <p class="mt-2 text-[11px] leading-tight text-muted-foreground">Multinational &amp; regional</p>
          </div>
          <div class="px-1 py-6 lg:px-6">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Assets covered</p>
            <p class="mt-3 font-display text-3xl leading-none text-foreground">$56.6T</p>
            <p class="mt-2 text-[11px] leading-tight text-muted-foreground">Reported balance sheets</p>
          </div>
          <div class="px-1 py-6 lg:px-6">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Median ROE</p>
            <p class="mt-3 font-display text-3xl leading-none text-foreground">11.3%</p>
            <p class="mt-2 text-[11px] leading-tight text-muted-foreground">Operating profitability</p>
          </div>
          <div class="px-1 py-6 lg:px-6">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Median forecast</p>
            <p class="mt-3 font-display text-3xl leading-none text-foreground">+4.0%</p>
            <p class="mt-2 text-[11px] leading-tight text-muted-foreground">Next-year net income</p>
          </div>
          <div class="px-1 py-6 lg:px-6">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Loss risk</p>
            <p class="mt-3 font-display text-3xl leading-none text-negative">13</p>
            <p class="mt-2 text-[11px] leading-tight text-muted-foreground">Balance sheets under stress</p>
          </div>
        </div>
      </div>

      <!-- 01 Signals: Market Sentiment -->
      <section class="mx-auto max-w-[1180px] px-5 pt-10 sm:px-8 sm:pt-12">
        <div class="overflow-hidden rounded-sm border border-border bg-card/40">
          <header class="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 px-6 py-4">
            <div>
              <h2 class="font-display text-lg text-foreground">Current market sentiment</h2>
              <p class="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                Bull &amp; bear indicators · 42 banks
              </p>
            </div>
            <div class="flex items-center gap-2.5">
              <span class="relative flex h-1.5 w-1.5">
                <span class="absolute inset-0 animate-ping rounded-full bg-positive/70"></span>
                <span class="relative h-1.5 w-1.5 rounded-full bg-positive"></span>
              </span>
              <span class="live-time-label font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Live · ${utcTime}</span>
              <button type="button" onclick="refreshLiveQuotes()" aria-label="Refresh live quotes" class="rounded-full border border-border p-1 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>
              </button>
            </div>
          </header>

          <div class="grid gap-6 px-6 py-5 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div class="flex flex-col items-center">
              <svg viewBox="0 0 200 116" class="w-full max-w-[210px]" role="img" aria-label="Bull and bear gauge">
                <path d="M 22.00 100.00 A 78 78 0 0 1 54.15 36.90" fill="none" stroke="hsl(var(--negative) / 0.45)" stroke-width="9"></path>
                <path d="M 54.15 36.90 A 78 78 0 0 1 145.85 36.90" fill="none" stroke="hsl(var(--muted-foreground) / 0.3)" stroke-width="9"></path>
                <path d="M 145.85 36.90 A 78 78 0 0 1 178.00 100.00" fill="none" stroke="hsl(var(--positive) / 0.45)" stroke-width="9"></path>
                <line x1="100" y1="100" x2="${needleX.toFixed(2)}" y2="${needleY.toFixed(2)}" stroke="${toneColor}" stroke-width="2.5" stroke-linecap="round"></line>
                <circle cx="100" cy="100" r="4" fill="${toneColor}"></circle>
                <text x="20" y="113" text-anchor="middle" class="fill-muted-foreground" style="font-size:7px; font-family:var(--font-mono); letter-spacing:0.16em">BEAR</text>
                <text x="180" y="113" text-anchor="middle" class="fill-muted-foreground" style="font-size:7px; font-family:var(--font-mono); letter-spacing:0.16em">BULL</text>
              </svg>
              <p class="num -mt-1 text-3xl leading-none text-foreground">${sentiment.score > 0 ? '+' : ''}${sentiment.score}</p>
              <p class="mt-1.5 font-mono text-[9px] uppercase tracking-[0.18em] ${sentiment.tone === 'positive' ? 'text-positive' : sentiment.tone === 'negative' ? 'text-negative' : 'text-caution'}">
                ${sentiment.label}
              </p>
              
              <div class="mt-4 w-full">
                <div class="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <span class="h-full" style="width:${sentiment.bullOdds}%; background:hsl(var(--positive));"></span>
                  <span class="h-full flex-1" style="background:hsl(var(--negative) / 0.7);"></span>
                </div>
                <div class="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.14em]">
                  <span class="text-positive">Bull ${sentiment.bullOdds}%</span>
                  <span class="text-negative">Bear ${100 - sentiment.bullOdds}%</span>
                </div>
              </div>
            </div>

            <div class="min-w-0">
              <p class="text-[12.5px] leading-relaxed text-foreground/90">${sentiment.summary}</p>
              <div class="mt-4">
                <ul class="space-y-3.5">
                  ${sentiment.signals.map(s => {
                    const isPositive = s.score >= 0;
                    const barWidth = Math.min(50, Math.abs(s.score) / 2);
                    const barLeft = isPositive ? 50 : (50 - barWidth);
                    const barColor = isPositive ? 'hsl(var(--positive) / 0.85)' : 'hsl(var(--negative) / 0.85)';
                    return `
                      <li>
                        <div class="flex items-baseline justify-between gap-3">
                          <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">${s.label}</p>
                          <p class="num text-[11px] ${isPositive ? 'text-positive' : 'text-negative'}">${isPositive ? '+' : ''}${s.score}</p>
                        </div>
                        <div class="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary/70">
                          <span class="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/80"></span>
                          <span class="absolute top-0 h-full rounded-full" style="width:${barWidth}%; left:${barLeft}%; background:${barColor};"></span>
                        </div>
                        <p class="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">${s.note}</p>
                      </li>
                    `;
                  }).join('')}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 02 Conviction: Negotiation Targets -->
      <section class="mx-auto max-w-[1180px] px-5 pt-16 sm:px-8 sm:pt-20">
        <div class="mb-8 max-w-2xl">
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">01 — Where to push</p>
          <h2 class="mt-3 font-display text-[1.9rem] leading-tight text-foreground sm:text-4xl">Negotiation targets</h2>
          <p class="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Banks whose returns, capital buffer and forecast earnings give you the strongest ground to open a deal from.
          </p>
        </div>

        <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          ${topPicks.map(b => `
            <div class="group flex flex-col justify-between rounded-sm border border-border bg-card/40 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card cursor-pointer" onclick="navigateTo('/banks/${b.id}')">
              <div>
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h3 class="font-display text-2xl leading-tight text-foreground">${b.name}</h3>
                    <p class="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">${b.hq_city} · ${b.country}</p>
                  </div>
                  ${renderVerdictBadge(b.verdict)}
                </div>

                <div class="mt-6 grid grid-cols-3 gap-2 border-y border-border/50 py-3.5">
                  <div>
                    <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">ROE</p>
                    <p class="num mt-1 text-[13px] text-foreground">${formatPct(b.roe_pct)}</p>
                  </div>
                  <div>
                    <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">CET1</p>
                    <p class="num mt-1 text-[13px] text-foreground">${formatPct(b.cet1_pct)}</p>
                  </div>
                  <div>
                    <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Forecast NI</p>
                    <p class="num mt-1 text-[13px] text-positive">${formatSignPct(b.forecast_ni_growth_pct)}</p>
                  </div>
                </div>

                <p class="mt-4 text-[12px] leading-relaxed text-muted-foreground line-clamp-3">
                  ${b.analyst_note}
                </p>
              </div>

              <div class="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                ${renderScoreRing(b.composite, 48)}
                <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-primary transition-opacity group-hover:opacity-70">
                  View analysis →
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- 03 Downside: Balance sheets under pressure -->
      <section class="mx-auto max-w-[1180px] px-5 pt-16 sm:px-8 sm:pt-20">
        <div class="mb-8 max-w-2xl">
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-negative">02 — Where to step back</p>
          <h2 class="mt-3 font-display text-[1.9rem] leading-tight text-foreground sm:text-4xl">Balance sheets under pressure</h2>
          <p class="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Banks whose cost structures, compressed margins or asset-quality metrics recommend renegotiating terms or walking away.
          </p>
        </div>

        <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          ${pressurePicks.map(b => `
            <div class="group flex flex-col justify-between rounded-sm border border-border/70 bg-card/30 p-5 transition-all duration-300 hover:border-negative/40 hover:bg-card/50 cursor-pointer" onclick="navigateTo('/banks/${b.id}')">
              <div>
                <div class="flex items-start justify-between gap-3">
                  <h3 class="font-display text-xl leading-tight text-foreground">${b.name}</h3>
                  <span class="num text-sm text-negative">${b.composite}</span>
                </div>
                <p class="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">${b.country} · ${b.category === 'multinational' ? 'Multinational' : 'Regional'}</p>

                <div class="mt-4 space-y-2 border-t border-border/40 pt-3 text-[11px]">
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Assets</span>
                    <span class="num text-foreground">${formatMoney(b.total_assets_bn)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Cost-income</span>
                    <span class="num text-foreground">${formatPct(b.cost_income_pct, 0)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Forecast NI</span>
                    <span class="num ${b.forecast_ni_growth_pct >= 0 ? 'text-positive' : 'text-negative'}">${formatSignPct(b.forecast_ni_growth_pct)}</span>
                  </div>
                </div>

                <p class="mt-3 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  ${b.key_risk}
                </p>
              </div>

              <div class="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                ${renderVerdictBadge(b.verdict)}
                <span class="text-muted-foreground transition-colors group-hover:text-primary">→</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- 04 Cohorts: Multinational vs Regional -->
      <section class="mx-auto max-w-[1180px] px-5 pt-16 sm:px-8 sm:pt-20">
        <div class="mb-8 max-w-2xl">
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">03 — Structural split</p>
          <h2 class="mt-3 font-display text-[1.9rem] leading-tight text-foreground sm:text-4xl">Multinational versus regional</h2>
          <p class="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Regional banks often carry higher return on equity and leaner cost structures, while multinational balance sheets offer unmatched liquidity and diversification.
          </p>
        </div>

        <div class="rounded-sm border border-border bg-card/40 p-6 sm:p-8">
          <div class="flex items-center justify-between border-b border-border/60 pb-4">
            <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Metric comparison</span>
            <div class="flex items-center gap-6">
              <span class="flex items-center gap-2 text-[12px] text-foreground">
                <span class="h-2 w-2 rounded-full bg-primary"></span> Multinational <span class="num text-[11px] text-muted-foreground">(${multi.length})</span>
              </span>
              <span class="flex items-center gap-2 text-[12px] text-foreground">
                <span class="h-2 w-2 rounded-full bg-accent"></span> Regional <span class="num text-[11px] text-muted-foreground">(${regional.length})</span>
              </span>
            </div>
          </div>

          <div class="divide-y divide-border/30">
            ${groupStats.map(stat => {
              const maxVal = Math.max(stat.a, stat.b) || 1;
              const aPct = (stat.a / maxVal) * 100;
              const bPct = (stat.b / maxVal) * 100;
              return `
                <div class="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3.5">
                  <span class="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">${stat.label}</span>
                  <span class="num w-20 text-right text-[13px] text-primary">${stat.format(stat.a)}</span>
                  <span class="num w-20 text-right text-[13px] text-accent">${stat.format(stat.b)}</span>
                  <div class="col-span-3 mt-1 grid grid-cols-2 gap-3">
                    <div class="h-[3px] overflow-hidden rounded-full bg-border/50">
                      <div class="h-full bg-primary" style="width:${aPct}%;"></div>
                    </div>
                    <div class="h-[3px] overflow-hidden rounded-full bg-border/50">
                      <div class="h-full bg-accent" style="width:${bPct}%;"></div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </section>

      <!-- Teaser CTA -->
      <section class="mx-auto max-w-[1180px] px-5 py-20 sm:px-8">
        <div class="rounded-sm border border-border bg-gradient-to-r from-card/80 to-card/40 p-8 sm:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div class="max-w-xl">
            <h3 class="font-display text-2xl sm:text-3xl text-foreground">Dive into the complete 42-bank global screener</h3>
            <p class="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Filter by region, solvency ratio, ROE, net interest margin, and valuation multiples. Or consult the AI banking analyst for dynamic projections.
            </p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <a href="#/screener" class="rounded-sm bg-primary px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-primary-foreground hover:opacity-90">
              Launch screener
            </a>
            <a href="#/analyst" class="rounded-sm border border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground hover:border-primary/40">
              Ask AI analyst
            </a>
          </div>
        </div>
      </section>
    `;
  }

  // ==========================================
  // VIEW 2: SCREENER PAGE
  // ==========================================
  function getSortLabel(key) {
    const map = {
      composite: 'Ledger Score',
      total_assets_bn: 'Total Assets',
      roe_pct: 'Return on Equity (ROE)',
      cet1_pct: 'CET1 Ratio',
      cost_income_pct: 'Cost-to-Income',
      forecast_ni_growth_pct: 'Forecast Earnings',
      market_cap_bn: 'Market Cap',
      name: 'Bank Name'
    };
    return map[key] || key;
  }

  window.setSortBy = function (key) {
    if (screenerFilters.sortBy === key) {
      screenerFilters.sortDir = screenerFilters.sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      screenerFilters.sortBy = key;
      screenerFilters.sortDir = 'desc';
    }
    const appContainer = document.getElementById('app-content');
    renderScreener(appContainer);
  };

  let screenerFilters = {
    search: '',
    category: 'all',
    region: 'all',
    verdict: 'all',
    sortBy: 'composite',
    sortDir: 'desc',
    viewMode: 'table'
  };

  function renderScreener(container) {
    let filtered = banks.filter(b => {
      if (screenerFilters.category !== 'all' && b.category !== screenerFilters.category) return false;
      if (screenerFilters.region !== 'all' && b.region !== screenerFilters.region) return false;
      if (screenerFilters.verdict !== 'all' && b.verdict !== screenerFilters.verdict) return false;
      if (screenerFilters.search) {
        const query = screenerFilters.search.toLowerCase();
        const match = `${b.name} ${b.ticker} ${b.country} ${b.hq_city}`.toLowerCase();
        if (!match.includes(query)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let aVal = a[screenerFilters.sortBy];
      let bVal = b[screenerFilters.sortBy];
      if (typeof aVal === 'string') {
        return screenerFilters.sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return screenerFilters.sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    container.innerHTML = `
      <div class="mx-auto max-w-[1180px] px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <!-- Header -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">Global bank book</p>
            <h1 class="mt-2 font-display text-[2.2rem] leading-tight text-foreground sm:text-4xl">
              Cross-border bank screener
            </h1>
          </div>
          <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Showing <span class="text-foreground font-semibold">${filtered.length}</span> of 42 institutions
          </p>
        </div>

        <!-- Filter Controls Bar -->
        <div class="mt-8 space-y-4 rounded-sm border border-border bg-card/40 p-4 sm:p-5">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input 
              type="text" 
              id="screener-search" 
              placeholder="Search bank, ticker, country…" 
              value="${screenerFilters.search}"
              class="w-full rounded-sm border border-border/80 bg-background/60 px-3.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            />

            <select id="screener-category" class="custom-select">
              <option value="all" ${screenerFilters.category === 'all' ? 'selected' : ''}>All Categories</option>
              <option value="multinational" ${screenerFilters.category === 'multinational' ? 'selected' : ''}>Multinational Banks</option>
              <option value="regional" ${screenerFilters.category === 'regional' ? 'selected' : ''}>Regional Banks</option>
            </select>

            <select id="screener-region" class="custom-select">
              <option value="all" ${screenerFilters.region === 'all' ? 'selected' : ''}>All Regions</option>
              <option value="North America" ${screenerFilters.region === 'North America' ? 'selected' : ''}>North America</option>
              <option value="Europe" ${screenerFilters.region === 'Europe' ? 'selected' : ''}>Europe</option>
              <option value="Asia-Pacific" ${screenerFilters.region === 'Asia-Pacific' ? 'selected' : ''}>Asia-Pacific</option>
              <option value="Middle East & Africa" ${screenerFilters.region === 'Middle East & Africa' ? 'selected' : ''}>Middle East &amp; Africa</option>
              <option value="Latin America" ${screenerFilters.region === 'Latin America' ? 'selected' : ''}>Latin America</option>
            </select>

            <select id="screener-verdict" class="custom-select">
              <option value="all" ${screenerFilters.verdict === 'all' ? 'selected' : ''}>All Verdicts</option>
              <option value="negotiate" ${screenerFilters.verdict === 'negotiate' ? 'selected' : ''}>Negotiation target</option>
              <option value="monitor" ${screenerFilters.verdict === 'monitor' ? 'selected' : ''}>Hold &amp; monitor</option>
              <option value="at_risk" ${screenerFilters.verdict === 'at_risk' ? 'selected' : ''}>Loss risk</option>
            </select>
          </div>

          <!-- Bottom bar: Sorting & View mode -->
          <div class="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4">
            <!-- Sort Controls Box with High-Visibility styling -->
            <div class="sort-box-container">
              <span class="text-primary font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 px-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary">
                  <path d="m3 16 4 4 4-4"></path><path d="M7 20V4"></path><path d="m21 8-4-4-4 4"></path><path d="M17 4v16"></path>
                </svg>
                Sort By:
              </span>
              <select id="screener-sort" class="custom-select font-medium text-[13px] text-foreground focus:outline-none">
                <option value="composite" ${screenerFilters.sortBy === 'composite' ? 'selected' : ''}>Ledger Score (0-100)</option>
                <option value="total_assets_bn" ${screenerFilters.sortBy === 'total_assets_bn' ? 'selected' : ''}>Total Assets ($B / $T)</option>
                <option value="roe_pct" ${screenerFilters.sortBy === 'roe_pct' ? 'selected' : ''}>Return on Equity (ROE %)</option>
                <option value="cet1_pct" ${screenerFilters.sortBy === 'cet1_pct' ? 'selected' : ''}>CET1 Capital Ratio (%)</option>
                <option value="cost_income_pct" ${screenerFilters.sortBy === 'cost_income_pct' ? 'selected' : ''}>Cost-to-Income Ratio (%)</option>
                <option value="forecast_ni_growth_pct" ${screenerFilters.sortBy === 'forecast_ni_growth_pct' ? 'selected' : ''}>Forecast Net Income Growth (%)</option>
                <option value="market_cap_bn" ${screenerFilters.sortBy === 'market_cap_bn' ? 'selected' : ''}>Market Capitalization ($B)</option>
              </select>
              <button id="screener-sort-dir" type="button" class="sort-dir-btn">
                <span>${screenerFilters.sortDir === 'desc' ? 'High → Low ↓' : 'Low → High ↑'}</span>
              </button>
            </div>

            <!-- View toggle & Active sort description -->
            <div class="flex items-center gap-4">
              <span class="text-[11px] font-mono text-muted-foreground hidden md:inline">
                Active Sort: <strong class="text-primary font-semibold">${getSortLabel(screenerFilters.sortBy)} (${screenerFilters.sortDir === 'desc' ? 'Highest First' : 'Lowest First'})</strong>
              </span>
              <div class="flex items-center gap-1 rounded-sm border border-border p-1 bg-card">
                <button id="view-table-btn" type="button" class="px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-sm ${screenerFilters.viewMode === 'table' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'}">
                  Table
                </button>
                <button id="view-grid-btn" type="button" class="px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-sm ${screenerFilters.viewMode === 'grid' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'}">
                  Cards
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Results Display -->
        <div class="mt-6">
          ${screenerFilters.viewMode === 'table' ? renderScreenerTable(filtered) : renderScreenerGrid(filtered)}
        </div>
      </div>
    `;

    const searchInput = document.getElementById('screener-search');
    searchInput.addEventListener('input', e => {
      screenerFilters.search = e.target.value;
      renderScreener(container);
    });

    document.getElementById('screener-category').addEventListener('change', e => {
      screenerFilters.category = e.target.value;
      renderScreener(container);
    });

    document.getElementById('screener-region').addEventListener('change', e => {
      screenerFilters.region = e.target.value;
      renderScreener(container);
    });

    document.getElementById('screener-verdict').addEventListener('change', e => {
      screenerFilters.verdict = e.target.value;
      renderScreener(container);
    });

    document.getElementById('screener-sort').addEventListener('change', e => {
      screenerFilters.sortBy = e.target.value;
      renderScreener(container);
    });

    document.getElementById('screener-sort-dir').addEventListener('click', () => {
      screenerFilters.sortDir = screenerFilters.sortDir === 'desc' ? 'asc' : 'desc';
      renderScreener(container);
    });

    document.getElementById('view-table-btn').addEventListener('click', () => {
      screenerFilters.viewMode = 'table';
      renderScreener(container);
    });

    document.getElementById('view-grid-btn').addEventListener('click', () => {
      screenerFilters.viewMode = 'grid';
      renderScreener(container);
    });
  }

  function renderScreenerTable(list) {
    if (!list.length) {
      return `
        <div class="rounded-sm border border-dashed border-border p-12 text-center">
          <p class="text-sm text-muted-foreground">No banking institutions match your filter criteria.</p>
        </div>
      `;
    }

    return `
      <div class="overflow-x-auto rounded-sm border border-border bg-card/40">
        <table class="w-full text-left text-[12px]">
          <thead class="border-b border-border/60 bg-muted/40 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th class="py-3.5 pl-4 pr-3 sortable-th" onclick="setSortBy('name')">
                Bank ${screenerFilters.sortBy === 'name' ? (screenerFilters.sortDir === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th class="py-3.5 px-3">Category</th>
              <th class="py-3.5 px-3">Region</th>
              <th class="py-3.5 px-3 text-right sortable-th" onclick="setSortBy('total_assets_bn')">
                Assets ${screenerFilters.sortBy === 'total_assets_bn' ? (screenerFilters.sortDir === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th class="py-3.5 px-3 text-right sortable-th" onclick="setSortBy('roe_pct')">
                ROE ${screenerFilters.sortBy === 'roe_pct' ? (screenerFilters.sortDir === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th class="py-3.5 px-3 text-right sortable-th" onclick="setSortBy('cet1_pct')">
                CET1 ${screenerFilters.sortBy === 'cet1_pct' ? (screenerFilters.sortDir === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th class="py-3.5 px-3 text-right sortable-th" onclick="setSortBy('cost_income_pct')">
                Cost-Income ${screenerFilters.sortBy === 'cost_income_pct' ? (screenerFilters.sortDir === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th class="py-3.5 px-3 text-right sortable-th" onclick="setSortBy('forecast_ni_growth_pct')">
                Forecast NI ${screenerFilters.sortBy === 'forecast_ni_growth_pct' ? (screenerFilters.sortDir === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th class="py-3.5 px-3 text-center sortable-th text-primary font-bold" onclick="setSortBy('composite')">
                Score ${screenerFilters.sortBy === 'composite' ? (screenerFilters.sortDir === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th class="py-3.5 px-3 text-left">Verdict</th>
              <th class="py-3.5 pr-4 pl-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/40">
            ${list.map(b => {
              const q = quotes[b.ticker];
              const isUp = q && q.change_pct >= 0;
              return `
                <tr class="transition-colors hover:bg-muted/40 cursor-pointer" onclick="navigateTo('/banks/${b.id}')">
                  <td class="py-3.5 pl-4 pr-3">
                    <div class="font-medium text-foreground">${b.name}</div>
                    <div class="font-mono text-[10px] text-muted-foreground">
                      ${b.ticker} · ${b.country}
                      ${q ? `<span class="ml-1 ${isUp ? 'text-positive' : 'text-negative'}">${isUp ? '▲' : '▼'} ${Math.abs(q.change_pct).toFixed(1)}%</span>` : ''}
                    </div>
                  </td>
                  <td class="py-3.5 px-3">
                    <span class="inline-block rounded-xs px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${b.category === 'multinational' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}">
                      ${b.category === 'multinational' ? 'Multi' : 'Regional'}
                    </span>
                  </td>
                  <td class="py-3.5 px-3 text-muted-foreground">${b.region}</td>
                  <td class="py-3.5 px-3 text-right num text-foreground">${formatMoney(b.total_assets_bn)}</td>
                  <td class="py-3.5 px-3 text-right num text-foreground">${formatPct(b.roe_pct)}</td>
                  <td class="py-3.5 px-3 text-right num text-foreground">${formatPct(b.cet1_pct)}</td>
                  <td class="py-3.5 px-3 text-right num text-foreground">${formatPct(b.cost_income_pct, 0)}</td>
                  <td class="py-3.5 px-3 text-right num ${b.forecast_ni_growth_pct >= 0 ? 'text-positive' : 'text-negative'}">
                    ${formatSignPct(b.forecast_ni_growth_pct)}
                  </td>
                  <td class="py-3.5 px-3 text-center num font-semibold ${b.composite >= 63 ? 'text-positive' : b.composite < 44 ? 'text-negative' : 'text-caution'}">
                    ${b.composite}
                  </td>
                  <td class="py-3.5 px-3">${renderVerdictBadge(b.verdict)}</td>
                  <td class="py-3.5 pr-4 pl-3 text-right">
                    <a href="#/banks/${b.id}" class="analysis-btn">
                      <span>Analysis</span>
                      <span>→</span>
                    </a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderScreenerGrid(list) {
    if (!list.length) {
      return `
        <div class="rounded-sm border border-dashed border-border p-12 text-center">
          <p class="text-sm text-muted-foreground">No banking institutions match your filter criteria.</p>
        </div>
      `;
    }

    return `
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        ${list.map(b => `
          <div class="rounded-sm border border-border bg-card/50 p-5 transition-all hover:border-primary/40 hover:bg-card cursor-pointer" onclick="navigateTo('/banks/${b.id}')">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="font-display text-xl leading-tight text-foreground">${b.name}</h3>
                <p class="font-mono text-[10px] uppercase text-muted-foreground">${b.ticker} · ${b.hq_city}, ${b.country}</p>
              </div>
              ${renderVerdictBadge(b.verdict)}
            </div>

            <div class="mt-4 grid grid-cols-3 gap-2 border-y border-border/40 py-2.5 text-center text-[11px]">
              <div>
                <span class="block font-mono text-[9px] uppercase text-muted-foreground">Assets</span>
                <span class="num text-foreground">${formatMoney(b.total_assets_bn)}</span>
              </div>
              <div>
                <span class="block font-mono text-[9px] uppercase text-muted-foreground">ROE</span>
                <span class="num text-foreground">${formatPct(b.roe_pct)}</span>
              </div>
              <div>
                <span class="block font-mono text-[9px] uppercase text-muted-foreground">Score</span>
                <span class="num font-semibold text-foreground">${b.composite}</span>
              </div>
            </div>

            <p class="mt-3 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
              ${b.analyst_note}
            </p>

            <div class="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-[10px] font-mono uppercase">
              <span class="text-muted-foreground">${b.category}</span>
              <a href="#/banks/${b.id}" class="analysis-btn">
                <span>View Analysis</span>
                <span>→</span>
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ==========================================
  // VIEW 3: GEOGRAPHY / MAP PAGE
  // ==========================================
  let selectedMapBank = null;
  let activeMapRegion = 'all';

  function renderMap(container) {
    container.innerHTML = `
      <div class="mx-auto max-w-[1180px] px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <!-- Header -->
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">Spatial distribution</p>
            <h1 class="mt-2 font-display text-[2.2rem] leading-tight text-foreground sm:text-4xl">
              Global banking geography
            </h1>
          </div>
          <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Bubble size reflects asset scale · Color reflects signal
          </p>
        </div>

        <!-- Region selector tabs -->
        <div class="mt-6 flex flex-wrap gap-1.5 border-b border-border/60 pb-3 font-mono text-[11px] uppercase tracking-wider">
          <button class="map-reg-btn px-3 py-1.5 rounded-sm ${activeMapRegion === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}" data-reg="all">All</button>
          <button class="map-reg-btn px-3 py-1.5 rounded-sm ${activeMapRegion === 'North America' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}" data-reg="North America">North America</button>
          <button class="map-reg-btn px-3 py-1.5 rounded-sm ${activeMapRegion === 'Europe' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}" data-reg="Europe">Europe</button>
          <button class="map-reg-btn px-3 py-1.5 rounded-sm ${activeMapRegion === 'Asia-Pacific' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}" data-reg="Asia-Pacific">Asia-Pacific</button>
          <button class="map-reg-btn px-3 py-1.5 rounded-sm ${activeMapRegion === 'Middle East & Africa' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}" data-reg="Middle East & Africa">Middle East &amp; Africa</button>
          <button class="map-reg-btn px-3 py-1.5 rounded-sm ${activeMapRegion === 'Latin America' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}" data-reg="Latin America">Latin America</button>
        </div>

        <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div class="relative overflow-hidden rounded-sm border border-border bg-[#090d12]" style="height: 560px;">
            <div id="leaflet-map-root" class="h-full w-full"></div>
            <div class="absolute bottom-4 left-4 z-[400] flex items-center gap-3 rounded-sm border border-border/80 bg-background/90 px-3.5 py-2 backdrop-blur-md font-mono text-[10px] uppercase">
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-positive"></span>Negotiate</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-caution"></span>Hold</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-negative"></span>Loss risk</span>
            </div>
          </div>

          <div id="map-side-panel" class="rounded-sm border border-border bg-card/50 p-6 flex flex-col justify-between">
            ${renderMapSidePanel(selectedMapBank)}
          </div>
        </div>
      </div>
    `;

    setTimeout(initLeafletMap, 50);

    document.querySelectorAll('.map-reg-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        activeMapRegion = e.target.getAttribute('data-reg');
        document.querySelectorAll('.map-reg-btn').forEach(b => {
          b.className = 'map-reg-btn px-3 py-1.5 rounded-sm text-muted-foreground hover:text-foreground';
        });
        e.target.className = 'map-reg-btn px-3 py-1.5 rounded-sm bg-primary text-primary-foreground';
        flyToRegion(activeMapRegion);
      });
    });
  }

  function renderMapSidePanel(bank) {
    if (!bank) {
      return `
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Reading the map</p>
          <p class="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            Each circle represents a banking institution. Diameter scales with reported balance-sheet asset volume, and fill reflects our analytical signal.
          </p>
          <div class="mt-6 space-y-3">
            <div class="flex items-center gap-2.5 text-[12px] text-foreground">
              <span class="h-2 w-2 rounded-full bg-positive"></span>
              <span>Negotiation target (Upper quintile)</span>
            </div>
            <div class="flex items-center gap-2.5 text-[12px] text-foreground">
              <span class="h-2 w-2 rounded-full bg-caution"></span>
              <span>Hold &amp; monitor (Equilibrium)</span>
            </div>
            <div class="flex items-center gap-2.5 text-[12px] text-foreground">
              <span class="h-2 w-2 rounded-full bg-negative"></span>
              <span>Loss risk (Vulnerable capital / margin)</span>
            </div>
          </div>
        </div>
        <div class="border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
          Click any marker on the map to inspect its fundamental breakdown.
        </div>
      `;
    }

    return `
      <div>
        <div class="flex items-start justify-between gap-3">
          <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Selected asset</p>
          <button type="button" onclick="clearMapSelection()" class="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">Clear</button>
        </div>
        <h3 class="mt-3 font-display text-2xl leading-tight text-foreground">${bank.name}</h3>
        <p class="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">${bank.hq_city}, ${bank.country}</p>
        
        <div class="mt-4">${renderVerdictBadge(bank.verdict)}</div>

        <div class="mt-5 space-y-2.5 border-t border-border/60 pt-4 text-[12px]">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Assets</span>
            <span class="num text-foreground">${formatMoney(bank.total_assets_bn)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">ROE</span>
            <span class="num text-foreground">${formatPct(bank.roe_pct)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">CET1</span>
            <span class="num text-foreground">${formatPct(bank.cet1_pct)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">NPL</span>
            <span class="num text-foreground">${formatPct(bank.npl_pct)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Forecast</span>
            <span class="num ${bank.forecast_ni_growth_pct >= 0 ? 'text-positive' : 'text-negative'}">${formatSignPct(bank.forecast_ni_growth_pct)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Ledger Score</span>
            <span class="num font-semibold text-foreground">${bank.composite}</span>
          </div>
        </div>
      </div>

      <a href="#/banks/${bank.id}" class="mt-6 block w-full rounded-sm bg-primary/20 border border-primary/40 py-2.5 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-primary hover:bg-primary hover:text-primary-foreground transition-all">
        Open full analysis →
      </a>
    `;
  }

  window.clearMapSelection = function () {
    selectedMapBank = null;
    const panel = document.getElementById('map-side-panel');
    if (panel) panel.innerHTML = renderMapSidePanel(null);
  };

  function initLeafletMap() {
    const mapRoot = document.getElementById('leaflet-map-root');
    if (!mapRoot || typeof L === 'undefined') return;

    if (leafletMapInstance) {
      leafletMapInstance.remove();
      leafletMapInstance = null;
    }

    leafletMapInstance = L.map('leaflet-map-root', {
      center: [26, 12],
      zoom: 2,
      minZoom: 1.5,
      maxZoom: 9,
      attributionControl: false
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16
    }).addTo(leafletMapInstance);

    banks.forEach(b => {
      if (!b.lat || !b.lng) return;

      const radius = Math.max(6, Math.min(26, Math.sqrt(b.total_assets_bn) * 0.42));
      const color = b.verdict === 'negotiate' ? '#34d399' : b.verdict === 'at_risk' ? '#f87171' : '#fbbf24';

      const circle = L.circleMarker([b.lat, b.lng], {
        radius: radius,
        fillColor: color,
        color: '#ffffff',
        weight: 1.2,
        opacity: 0.85,
        fillOpacity: 0.65
      }).addTo(leafletMapInstance);

      circle.bindTooltip(`<strong>${b.name}</strong><br><span style="font-family: monospace;">Score: ${b.composite} | Assets: ${formatMoney(b.total_assets_bn)}</span>`, {
        direction: 'top',
        className: 'leaflet-popup-content-wrapper'
      });

      circle.on('click', () => {
        selectedMapBank = b;
        const panel = document.getElementById('map-side-panel');
        if (panel) panel.innerHTML = renderMapSidePanel(b);
        leafletMapInstance.panTo([b.lat, b.lng]);
      });
    });
  }

  function flyToRegion(reg) {
    if (!leafletMapInstance) return;
    const coords = {
      'all': { center: [26, 12], zoom: 2 },
      'North America': { center: [40, -98], zoom: 3.5 },
      'Europe': { center: [48, 14], zoom: 4 },
      'Asia-Pacific': { center: [28, 105], zoom: 3.5 },
      'Middle East & Africa': { center: [12, 38], zoom: 3.5 },
      'Latin America': { center: [-15, -60], zoom: 3.5 }
    };
    const c = coords[reg] || coords.all;
    leafletMapInstance.flyTo(c.center, c.zoom, { duration: 1.2 });
  }

  // ==========================================
  // VIEW 4: AI ANALYST PAGE
  // ==========================================
  let activeAnalystBankId = banks[0]?.id;
  let analystMessages = [];
  let isAnalystThinking = false;

  function generateForecast(bank) {
    const ni = bank.net_income_bn || 1;
    const growth = bank.forecast_ni_growth_pct || 2;
    const roe = bank.roe_pct || 10;
    const cet1 = bank.cet1_pct || 12;
    const loanGrowth = bank.loan_growth_pct || 3;
    const npl = bank.npl_pct || 1.5;
    const composite = bank.composite || 50;

    const bullGrowth = Math.round((growth + Math.max(2.5, growth * 0.4)) * 10) / 10;
    const baseGrowth = growth;
    const bearGrowth = Math.round((growth - Math.max(3.5, Math.abs(growth) * 0.6 + 2)) * 10) / 10;

    const projNi = Math.round(ni * (1 + baseGrowth / 100) * 10) / 10;
    const projRoe = Math.round((roe + (baseGrowth > 0 ? 0.3 : -0.5)) * 10) / 10;
    const projCet1 = Math.round((cet1 + (baseGrowth > 3 ? 0.2 : -0.2)) * 10) / 10;
    const projLoan = Math.round((loanGrowth + (baseGrowth > 0 ? 0.5 : -0.8)) * 10) / 10;
    const projNpl = Math.round((npl + (baseGrowth < 0 ? 0.2 : -0.05)) * 100) / 100;

    const assets = Number(bank.total_assets_bn) || 100;
    const hqla = assets * (0.12 + Math.max(0, cet1 - 10) * 0.006);
    const outflows = assets * (0.20 + Math.max(0, 12 - cet1) * 0.01 + npl * 0.01);
    const inflows = outflows * Math.max(0.25, 0.50 - npl * 0.02);
    const netOutflows = Math.max(0.5, outflows - Math.min(inflows, outflows * 0.75));
    const currentLcr = Math.round((hqla / netOutflows) * 1000) / 10;
    const projectedLcr = Math.round((currentLcr + (baseGrowth >= 0 ? 3.2 : -4.5)) * 10) / 10;
    const bullLcr = Math.round((currentLcr + Math.max(4.5, Math.abs(bullGrowth) * 0.35)) * 10) / 10;
    const bearLcr = Math.round((currentLcr - Math.max(6, Math.abs(bearGrowth) * 0.8)) * 10) / 10;

    let headline = '';
    let recommendation = '';
    if (composite >= 63) {
      headline = `${bank.name}: Premium franchise commanding superior pricing power and structural tailwinds`;
      recommendation = `Open negotiations from a position of pricing strength. The ${cet1}% CET1 capital buffer affords strong downside protection while the ${bank.nim_pct}% NIM insulates funding costs.`;
    } else if (composite < 44) {
      headline = `${bank.name}: Margin compression and cost headwinds require stringent underwriting terms`;
      recommendation = `Step back or demand strict covenant protection. A ${bank.cost_income_pct}% cost base leaves minimal operating leverage if net interest margins compress.`;
    } else {
      headline = `${bank.name}: Solid regional deposit base offset by selective asset-quality sensitivity`;
      recommendation = `Maintain an opportunistic posture. Monitor deposit beta and commercial real estate exposures before committing balance-sheet capacity.`;
    }

    const confidence = Math.min(92, Math.max(72, Math.round(75 + (composite > 60 ? 8 : composite < 40 ? 4 : 6) + (Math.sin(bank.name.length) * 5))));

    return {
      horizon: 'FY2026',
      verdict: bank.verdict,
      headline,
      confidence,
      bank,
      currentLcr,
      projectedLcr,
      metrics: [
        { label: 'Net income', current: ni, projected: projNi, unit: 'bn', signal: baseGrowth >= 0 ? 'improving' : 'deteriorating' },
        { label: 'Return on equity', current: roe, projected: projRoe, unit: 'pct', signal: projRoe >= roe ? 'improving' : 'deteriorating' },
        { label: 'CET1 ratio', current: cet1, projected: projCet1, unit: 'pct', signal: projCet1 >= cet1 ? 'improving' : 'stable' },
        { label: 'Liquidity coverage ratio', current: currentLcr, projected: projectedLcr, unit: 'pct', signal: projectedLcr >= currentLcr ? 'improving' : 'deteriorating' },
        { label: 'Loan growth', current: loanGrowth, projected: projLoan, unit: 'pct', signal: projLoan >= loanGrowth ? 'improving' : 'stable' },
        { label: 'Gross NPL ratio', current: npl, projected: projNpl, unit: 'pct', signal: projNpl <= npl ? 'improving' : 'deteriorating' }
      ],
      scenarios: [
        { name: 'Bull', net_income_growth_pct: bullGrowth, lcr: bullLcr, note: `Accelerated loan origination in ${bank.country} and stable credit loss absorption.` },
        { name: 'Base', net_income_growth_pct: baseGrowth, lcr: projectedLcr, note: `Central case assumes ${bank.loan_growth_pct}% loan expansion with policy rates plateauing.` },
        { name: 'Bear', net_income_growth_pct: bearGrowth, lcr: bearLcr, note: `Elevated provisioning on commercial books and competitive deposit re-pricing.` }
      ],
      drivers: [
        bank.key_strength || 'Robust core deposit franchise and disciplined expense management',
        `Leading footprint in ${bank.hq_city}, ${bank.country} with stable retail funding`
      ],
      risks: [
        bank.key_risk || 'Macroeconomic deceleration impacting private loan demand',
        `Sensitivity to central bank policy rate inflection and margin compression`
      ],
      recommendation
    };
  }

  function renderAnalyst(container) {
    const bank = banks.find(b => b.id === activeAnalystBankId) || banks[0];
    const forecast = generateForecast(bank);
    const quote = quotes[bank.ticker];

    container.innerHTML = `
      <div class="mx-auto max-w-[1180px] px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <!-- Header -->
        <div class="max-w-2xl">
          <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">AI analyst</p>
          <h1 class="mt-4 font-display text-[2.3rem] leading-tight text-foreground sm:text-5xl">
            What the figures will do next
          </h1>
          <p class="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            Pick a bank and the analyst projects next year's net income, revenue, return on equity, cost base and credit losses — then tells you whether the negotiating position is worth taking. Ask it anything afterwards.
          </p>
        </div>

        <div class="mt-8 rounded-sm border border-border bg-card/60 p-4 sm:p-5">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap items-center gap-3">
              <span class="rounded-xs bg-primary/10 border border-primary/30 px-2.5 py-1 font-mono text-[11px] font-bold text-primary uppercase tracking-wider">
                ${bank.name} (${bank.ticker})
              </span>
              <span class="font-mono text-[11px] text-muted-foreground">Balance Sheet Total: <strong class="text-foreground">${formatMoney(bank.total_assets_bn)}</strong></span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Liquidity coverage ratio</span>
              <span class="num text-lg font-bold ${forecast.currentLcr >= 130 ? 'text-positive' : forecast.currentLcr >= 100 ? 'text-caution' : 'text-negative'}">${Math.round(forecast.currentLcr)}%</span>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${forecast.currentLcr >= 100 ? 'bg-positive/10 text-positive border border-positive/30' : 'bg-negative/10 text-negative border border-negative/30'}">
                ${forecast.currentLcr >= 100 ? 'Above 100% floor' : 'Below 100% floor'}
              </span>
            </div>
          </div>
        </div>

        <div class="mt-8 grid gap-6 lg:grid-cols-[288px_minmax(0,1fr)]">
          <!-- Sidebar: Bank Picker -->
          <aside class="space-y-4">
            <div class="rounded-sm border border-border bg-card/40">
              <div class="border-b border-border/60 p-3">
                <input 
                  type="text" 
                  id="analyst-bank-search" 
                  placeholder="Find a bank…" 
                  class="w-full rounded-sm border border-border/70 bg-background/60 px-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <div id="analyst-bank-list" class="max-h-[460px] overflow-y-auto p-1.5 space-y-1">
                ${renderAnalystBankList(bank.id)}
              </div>
            </div>
            <p class="px-1 text-[11px] leading-relaxed text-muted-foreground">
              42 banks in the built-in dataset. Projections anchor to each bank's reported figures and peer group.
            </p>
          </aside>

          <!-- Main Content -->
          <div class="min-w-0 space-y-6">
            <!-- Forecast Card -->
            <article class="overflow-hidden rounded-sm border border-border bg-card/40">
              <header class="flex flex-col gap-5 border-b border-border/60 p-6 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2.5">
                    <p class="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">AI forecast · ${forecast.horizon}</p>
                    ${renderVerdictBadge(forecast.verdict)}
                  </div>
                  <h2 class="mt-3 font-display text-[1.45rem] leading-snug text-foreground sm:text-[1.7rem]">${forecast.headline}</h2>
                  <p class="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                    ${bank.name} · ${bank.ticker} · base case
                  </p>
                </div>
                <div class="flex shrink-0 flex-col gap-3 sm:items-end">
                  <div class="sm:text-right">
                    <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Confidence</p>
                    <p class="num mt-1 text-2xl leading-none text-foreground">${forecast.confidence}<span class="text-[11px] text-muted-foreground">/100</span></p>
                    <div class="mt-2 h-[3px] w-24 bg-secondary sm:ml-auto overflow-hidden rounded-full">
                      <div class="h-full bg-primary" style="width:${forecast.confidence}%"></div>
                    </div>
                  </div>
                  <button type="button" onclick="renderAnalyst(document.getElementById('app-content'))" class="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground hover:text-primary transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M21 21v-5h-5"></path></svg>
                    Regenerate
                  </button>
                </div>
              </header>

              <!-- Projected Figures -->
              <section class="border-b border-border/60 px-6 py-5">
                <div class="flex items-baseline justify-between gap-3">
                  <h3 class="font-display text-lg text-foreground">Projected figures</h3>
                  <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Reported → model</p>
                </div>
                <div class="mt-2 divide-y divide-border/40">
                  ${forecast.metrics.map(m => {
                    const diff = m.projected - m.current;
                    const deltaStr = m.unit === 'pct' ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pts` : `${diff >= 0 ? '+' : ''}${(diff / m.current * 100).toFixed(1)}%`;
                    const currentStr = m.unit === 'pct' ? formatPct(m.current) : formatMoney(m.current);
                    const projectedStr = m.unit === 'pct' ? formatPct(m.projected) : formatMoney(m.projected);
                    return `
                      <div class="flex items-baseline justify-between gap-4 py-3">
                        <div class="min-w-0">
                          <p class="truncate text-[13px] text-foreground">${m.label}</p>
                          <p class="num mt-0.5 text-[11px] text-muted-foreground">now ${currentStr}</p>
                        </div>
                        <div class="shrink-0 text-right">
                          <p class="num text-[15px] text-foreground font-medium">${projectedStr}</p>
                          <p class="num mt-0.5 text-[11px] ${m.signal === 'improving' ? 'text-positive' : 'text-negative'}">${deltaStr}</p>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </section>

              <!-- Scenarios -->
              <section class="border-b border-border/60 px-6 py-5">
                <h3 class="font-display text-lg text-foreground">Next-year earnings scenarios</h3>
                <div class="mt-4 grid gap-3 sm:grid-cols-3">
                  ${forecast.scenarios.map(sc => {
                    const color = sc.name === 'Bull' ? 'text-positive' : sc.name === 'Bear' ? 'text-negative' : 'text-primary';
                    const barBg = sc.name === 'Bull' ? 'bg-positive' : sc.name === 'Bear' ? 'bg-negative' : 'bg-primary';
                    return `
                      <div class="rounded-sm border border-border/70 bg-background/40 p-3.5">
                        <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">${sc.name} case</p>
                        <p class="num mt-2 text-xl leading-none ${color}">${sc.net_income_growth_pct > 0 ? '+' : ''}${sc.net_income_growth_pct.toFixed(1)}%</p>
                        <p class="num mt-1.5 text-[12px] text-foreground">LCR ${formatPct(sc.lcr)}</p>
                        <div class="mt-2.5 h-[3px] w-full bg-secondary overflow-hidden rounded-full">
                          <div class="h-full ${barBg}" style="width: 70%;"></div>
                        </div>
                        <p class="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">${sc.note}</p>
                      </div>
                    `;
                  }).join('')}
                </div>
              </section>

              <!-- Drivers & Risks -->
              <section class="grid gap-6 border-b border-border/60 px-6 py-5 sm:grid-cols-2">
                <div>
                  <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-positive font-semibold">What drives the base case</p>
                  <ul class="mt-2.5 space-y-2">
                    ${forecast.drivers.map(d => `
                      <li class="flex gap-2 text-[12px] leading-relaxed text-foreground/90">
                        <span class="text-positive">↑</span><span>${d}</span>
                      </li>
                    `).join('')}
                  </ul>
                </div>
                <div>
                  <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-negative font-semibold">What would break it</p>
                  <ul class="mt-2.5 space-y-2">
                    ${forecast.risks.map(r => `
                      <li class="flex gap-2 text-[12px] leading-relaxed text-foreground/90">
                        <span class="text-negative">↓</span><span>${r}</span>
                      </li>
                    `).join('')}
                  </ul>
                </div>
              </section>

              <!-- Stance Footer -->
              <footer class="p-6">
                <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">Negotiating position</p>
                <p class="mt-2.5 font-display text-lg leading-relaxed text-foreground">${forecast.recommendation}</p>
                <p class="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Model projection built from this app's built-in bank dataset — an analysis aid, not investment advice.
                </p>
              </footer>
            </article>

            <!-- Interrogate the forecast: Chat UI -->
            <section class="overflow-hidden rounded-sm border border-border bg-card/40">
              <header class="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 px-6 py-4">
                <h2 class="font-display text-lg text-foreground">Interrogate the forecast</h2>
                <p class="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  ${bank.name} · ${bank.ticker}
                </p>
              </header>

              <div id="analyst-messages" class="max-h-[380px] min-h-[140px] overflow-y-auto px-6 py-5 space-y-4">
                ${analystMessages.length === 0 ? `
                  <div class="rounded-sm border border-dashed border-border/70 px-4 py-6 text-center">
                    <p class="text-[12.5px] leading-relaxed text-muted-foreground">
                      Ask the analyst to stress-test ${bank.name}'s figures — capital, credit costs, margins or a scenario.
                    </p>
                  </div>
                ` : analystMessages.map(m => `
                  <div class="${m.role === 'user' ? 'flex justify-end' : 'border-l-2 border-primary/40 pl-4'}">
                    ${m.role === 'user' ? `
                      <p class="max-w-[85%] rounded-sm bg-secondary px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">${m.text}</p>
                    ` : `
                      <div>
                        <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">AI analyst</p>
                        <p class="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">${m.text}</p>
                      </div>
                    `}
                  </div>
                `).join('')}
                ${isAnalystThinking ? `
                  <div class="flex items-center gap-2 border-l-2 border-primary/20 pl-4 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"></span>
                    Reading the book…
                  </div>
                ` : ''}
              </div>

              <div class="border-t border-border/60 px-6 py-4">
                <div class="flex flex-wrap gap-1.5">
                  <button type="button" onclick="sendAnalystPrompt('What breaks this forecast?')" class="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
                    What breaks this forecast?
                  </button>
                  <button type="button" onclick="sendAnalystPrompt('Better deal than its closest peer?')" class="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
                    Better deal than its closest peer?
                  </button>
                  <button type="button" onclick="sendAnalystPrompt('How does a 100bp credit shock hit earnings?')" class="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
                    How does a 100bp credit shock hit earnings?
                  </button>
                </div>

                <div class="mt-3 flex items-end gap-2 rounded-sm border border-border/70 bg-background/60 px-3 py-2 focus-within:border-primary/50">
                  <textarea 
                    id="analyst-chat-input" 
                    rows="1" 
                    placeholder="Ask about capital, credit, margin, a scenario…" 
                    class="max-h-28 min-h-[36px] w-full resize-none bg-transparent text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitAnalystMessage();}"
                  ></textarea>
                  <button type="button" onclick="submitAnalystMessage()" aria-label="Send" class="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-primary text-primary-foreground hover:opacity-90">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path></svg>
                  </button>
                </div>
                <p class="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Model projections on the built-in dataset · not investment advice
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    `;

    const searchEl = document.getElementById('analyst-bank-search');
    searchEl.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.getElementById('analyst-bank-list').innerHTML = renderAnalystBankList(bank.id, q);
    });

  }

  function renderAnalystBankList(activeId, query = '') {
    const filtered = banks.filter(b => {
      if (!query) return true;
      return `${b.name} ${b.ticker} ${b.country}`.toLowerCase().includes(query);
    });

    if (!filtered.length) {
      return '<p class="p-3 text-center text-[11px] text-muted-foreground">No matching banks.</p>';
    }

    return filtered.map(b => {
      const isActive = b.id === activeId;
      return `
        <button 
          type="button" 
          onclick="selectAnalystBank('${b.id}')" 
          class="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left transition-colors ${isActive ? 'bg-secondary text-foreground ring-1 ring-border' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}"
        >
          <span class="min-w-0">
            <span class="block truncate text-[12.5px]">${b.name}</span>
            <span class="mt-0.5 block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">${b.country} · ${b.category === 'multinational' ? 'Multi' : 'Regional'}</span>
          </span>
          <span class="num shrink-0 text-[11px] text-muted-foreground">${b.composite}</span>
        </button>
      `;
    }).join('');
  }

  window.selectAnalystBank = function (id) {
    activeAnalystBankId = id;
    analystMessages = [];
    renderAnalyst(document.getElementById('app-content'));
  };

  window.sendAnalystPrompt = function (text) {
    const input = document.getElementById('analyst-chat-input');
    if (input) {
      input.value = text;
      submitAnalystMessage();
    }
  };

  window.submitAnalystMessage = function () {
    const input = document.getElementById('analyst-chat-input');
    const question = input.value.trim();
    if (!question || isAnalystThinking) return;

    analystMessages.push({ role: 'user', text: question });
    input.value = '';
    isAnalystThinking = true;

    updateAnalystMessagesUI();

    const bank = banks.find(b => b.id === activeAnalystBankId) || banks[0];

    setTimeout(() => {
      const answer = generateAnalystAnswer(bank, question);
      analystMessages.push({ role: 'analyst', text: answer });
      isAnalystThinking = false;
      updateAnalystMessagesUI();
    }, 600);
  };

  function updateAnalystMessagesUI() {
    const messagesContainer = document.getElementById('analyst-messages');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = analystMessages.map(m => `
      <div class="${m.role === 'user' ? 'flex justify-end' : 'border-l-2 border-primary/40 pl-4'}">
        ${m.role === 'user' ? `
          <p class="max-w-[85%] rounded-sm bg-secondary px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">${m.text}</p>
        ` : `
          <div>
            <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">AI analyst</p>
            <p class="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">${m.text}</p>
          </div>
        `}
      </div>
    `).join('') + (isAnalystThinking ? `
      <div class="flex items-center gap-2 border-l-2 border-primary/20 pl-4 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"></span>
        Reading the book…
      </div>
    ` : '');

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function generateAnalystAnswer(bank, q) {
    const query = q.toLowerCase();
    const assets = bank.total_assets_bn || 100;
    const cet1 = bank.cet1_pct || 12;
    const roe = bank.roe_pct || 10;
    const npl = bank.npl_pct || 1;
    const cost = bank.cost_income_pct || 55;
    const nim = bank.nim_pct || 2.5;

    if (query.includes('what breaks') || query.includes('break this')) {
      return `What breaks ${bank.name}'s forecast is a simultaneous contraction in Net Interest Margin below ${(nim * 0.85).toFixed(2)}% combined with an uptick in gross NPLs beyond ${(npl * 1.5).toFixed(1)}%. Given the bank's ${cost}% cost-to-income ratio, operating flexibility is bounded. Furthermore, ${bank.key_risk}.`;
    }

    if (query.includes('closest peer') || query.includes('better deal') || query.includes('peer')) {
      const peer = banks.filter(b => b.id !== bank.id && b.category === bank.category).sort((a, b) => Math.abs(b.composite - bank.composite))[0] || banks[1];
      const diff = bank.composite - peer.composite;
      return `Against its closest cohort peer ${peer.name} (Score: ${peer.composite}):
• ${bank.name} commands a ${roe}% ROE vs ${peer.name}'s ${peer.roe_pct}% ROE.
• Capital resilience: ${bank.name}'s CET1 sits at ${cet1}% vs ${peer.cet1_pct}%.
• ${diff >= 0 ? `${bank.name} is currently the stronger structural proposition (+ ${diff} score differential).` : `${peer.name} offers more attractive risk-adjusted entry metrics.`}`;
    }

    if (query.includes('lcr') || query.includes('liquidity')) {
      const forecast = generateForecast(bank);
      const byName = Object.fromEntries(forecast.scenarios.map(sc => [sc.name, sc.lcr]));
      return `${bank.name}'s modelled liquidity coverage ratio is ${formatPct(forecast.currentLcr)} now, against the 100% Basel floor, and ${formatPct(forecast.projectedLcr)} in the base case.
Bull case ${formatPct(byName.Bull)} · base case ${formatPct(byName.Base)} · bear case ${formatPct(byName.Bear)}.
The ratio is high-quality liquid assets divided by net cash outflows, with inflows capped at 75% of outflows.`;
    }

    if (query.includes('credit shock') || query.includes('100bp') || query.includes('shock')) {
      const shockProvision = (assets * 0.01 * 0.65).toFixed(1);
      const postShockCET1 = (cet1 - 0.75).toFixed(1);
      return `A 100 bps credit loss shock would add roughly $${shockProvision}B in pre-tax impairment allowances across the balance sheet.
This would compress reported ROE from ${roe}% down to approximately ${(roe * 0.78).toFixed(1)}%, while pro-forma CET1 would absorb into ${postShockCET1}%. The regulatory capital buffer remains ${postShockCET1 > 10.5 ? 'sufficiently intact above Basel thresholds' : 'strained against regulatory headroom'}.`;
    }

    return `Analysis for ${bank.name} (${bank.ticker}):
With $${formatMoney(assets)} in assets, ${bank.name} operates at a ${roe}% ROE and ${cet1}% CET1 ratio. Key operational strength rests on ${bank.key_strength}. From a negotiating standpoint, we recommend watching ${bank.key_risk} before expanding counterparty exposure.`;
  }

  // ==========================================
  // VIEW 5: DEDICATED FULL-PAGE BANK ANALYSIS
  // ==========================================
  function renderBankAnalysisPage(container, bankId) {
    const bank = banks.find(b => b.id === bankId) || banks[0];
    const peers = banks.filter(b => b.id !== bank.id && b.category === bank.category)
      .sort((a, b) => Math.abs(b.composite - bank.composite))
      .slice(0, 4);

    const pillars = [
      { 
        key: 'profitability', 
        label: 'Profitability', 
        weight: '34% Weight',
        score: bank.profitability,
        detail: 'Return on Equity (ROE: ' + formatPct(bank.roe_pct) + ') verified against Return on Assets (ROA: ' + formatPct(bank.roa_pct, 2) + ')' 
      },
      { 
        key: 'capital', 
        label: 'Capital & Credit Resilience', 
        weight: '26% Weight',
        score: bank.capital,
        detail: 'Common Equity Tier 1 (CET1: ' + formatPct(bank.cet1_pct) + ') buffer absorbing gross non-performing loans (NPL: ' + formatPct(bank.npl_pct) + ')' 
      },
      { 
        key: 'efficiency', 
        label: 'Operating Cost Efficiency', 
        weight: '14% Weight',
        score: bank.efficiency,
        detail: 'Cost-to-Income ratio (' + formatPct(bank.cost_income_pct, 0) + ') benchmarked against global banking median efficiency threshold' 
      },
      { 
        key: 'growth', 
        label: 'Growth & Earnings Trajectory', 
        weight: '26% Weight',
        score: bank.growth,
        detail: 'Domestic core loan expansion (' + formatSignPct(bank.loan_growth_pct) + ') combined with forecast net income momentum (' + formatSignPct(bank.forecast_ni_growth_pct) + ')' 
      }
    ];

    const metrics14 = [
      { label: 'Total Assets', value: formatMoney(bank.total_assets_bn), sub: 'Reported balance sheet size' },
      { label: 'Market Cap', value: formatMoney(bank.market_cap_bn), sub: 'Equity market valuation' },
      { label: 'Annual Revenue', value: formatMoney(bank.revenue_bn), sub: 'Total top-line income' },
      { label: 'Net Income', value: formatMoney(bank.net_income_bn), sub: 'Annual bottom-line profit' },
      { label: 'Return on Equity (ROE)', value: formatPct(bank.roe_pct), sub: 'Operating equity return' },
      { label: 'Return on Assets (ROA)', value: formatPct(bank.roa_pct, 2), sub: 'Asset yield efficiency' },
      { label: 'CET1 Ratio', value: formatPct(bank.cet1_pct), sub: 'Tier-1 regulatory capital buffer' },
      { label: 'Gross NPL Ratio', value: formatPct(bank.npl_pct), sub: 'Non-performing loan proportion' },
      { label: 'Cost-to-Income', value: formatPct(bank.cost_income_pct, 0), sub: 'Operating cost proportion' },
      { label: 'Net Interest Margin (NIM)', value: formatPct(bank.nim_pct), sub: 'Net interest spread' },
      { label: 'Loan Growth', value: formatSignPct(bank.loan_growth_pct), sub: '12-month loan volume change' },
      { label: 'Forecast NI Growth', value: formatSignPct(bank.forecast_ni_growth_pct), sub: 'Next-year net income guidance', isPositive: bank.forecast_ni_growth_pct >= 0 },
      { label: 'Price-to-Earnings (P/E)', value: Number(bank.pe_ratio).toFixed(1) + 'x', sub: 'Earnings valuation multiple' },
      { label: 'Dividend Yield', value: formatPct(bank.dividend_yield_pct), sub: 'Annual dividend return' }
    ];

    container.innerHTML = `
      <div class="mx-auto max-w-[1180px] px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        <div class="flex items-center justify-between border-b border-border/60 pb-5">
          <a href="#/screener" class="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors">
            <span class="text-primary font-bold">←</span> Back to Screener
          </a>
          <div class="flex items-center gap-3">
            <span class="font-mono text-[10px] uppercase text-muted-foreground hidden sm:inline">Credit Rating: <strong class="text-foreground">${bank.credit_rating || 'NR'}</strong></span>
            <span class="h-3 w-px bg-border hidden sm:inline"></span>
            <span class="font-mono text-[10px] uppercase text-muted-foreground">${bank.fiscal_year}</span>
          </div>
        </div>

        <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div class="flex flex-wrap items-center gap-2.5 mb-3">
              <span class="rounded-xs px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${bank.category === 'multinational' ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-accent/10 text-accent border border-accent/30'}">
                ${bank.category === 'multinational' ? 'Multinational Bank' : 'Regional Bank'}
              </span>
              ${renderVerdictBadge(bank.verdict, 'md')}
            </div>
            <h1 class="font-display text-4xl sm:text-5xl text-foreground">${bank.name}</h1>
            <p class="mt-2 font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
              ${bank.ticker} · ${bank.hq_city}, ${bank.country} · ${bank.region}
            </p>
            <p class="mt-4 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              ${bank.analyst_note}
            </p>
          </div>

          <div class="rounded-sm border border-border bg-card/60 p-6 flex flex-col items-center justify-center min-w-[240px]">
            ${renderScoreRing(bank.composite, 80, 'Composite Score')}
            <div class="mt-4 text-center">
              <p class="font-mono text-[11px] uppercase font-semibold ${bank.composite >= 63 ? 'text-positive' : bank.composite < 44 ? 'text-negative' : 'text-caution'}">
                ${VERDICTS[bank.verdict].label}
              </p>
              <p class="mt-1 text-[11px] leading-tight text-muted-foreground max-w-[200px]">
                ${VERDICTS[bank.verdict].blurb}
              </p>
            </div>
            <button type="button" onclick="selectAnalystBank('${bank.id}'); navigateTo('/analyst');" class="mt-4 w-full rounded-sm bg-primary/15 border border-primary/35 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary hover:text-primary-foreground transition-all">
              Stress-test in AI Analyst →
            </button>
          </div>
        </div>

        <div class="mt-12">
          <div class="flex items-baseline justify-between border-b border-border/60 pb-3 mb-5">
            <div>
              <h2 class="font-display text-2xl text-foreground">14 Balance-Sheet &amp; Performance Metrics</h2>
              <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">Comprehensive fundamental indicators</p>
            </div>
            <span class="font-mono text-[11px] text-primary">All figures USD converted</span>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            ${metrics14.map(m => `
              <div class="analysis-metric-card">
                <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">${m.label}</p>
                <p class="num mt-2 text-2xl font-semibold ${m.isPositive === true ? 'text-positive' : m.isPositive === false ? 'text-negative' : 'text-foreground'}">
                  ${m.value}
                </p>
                <p class="mt-1 text-[10px] text-muted-foreground">${m.sub}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="mt-12 rounded-sm border border-border bg-card/40 p-6 sm:p-8">
          <div class="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-border/60 pb-4 mb-6">
            <div>
              <h2 class="font-display text-2xl text-foreground">The Four Pillars Breakdown</h2>
              <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">How the 0—100 composite score is calibrated</p>
            </div>
            <span class="num text-[12px] text-muted-foreground mt-2 sm:mt-0">Overall Score: <strong class="text-foreground text-base">${bank.composite}</strong> / 100</span>
          </div>

          <div class="grid gap-6 md:grid-cols-2">
            ${pillars.map(p => {
              const barColor = p.score >= 63 ? 'bg-positive' : p.score >= 44 ? 'bg-caution' : 'bg-negative';
              const textColor = p.score >= 63 ? 'text-positive' : p.score >= 44 ? 'text-caution' : 'text-negative';
              return `
                <div class="rounded-sm border border-border/70 bg-background/30 p-5">
                  <div class="flex items-center justify-between">
                    <span class="font-display text-lg text-foreground">${p.label}</span>
                    <span class="num text-xl font-bold ${textColor}">${p.score} <span class="text-xs text-muted-foreground font-normal">/ 100</span></span>
                  </div>
                  <div class="flex items-center justify-between text-[10px] font-mono uppercase text-muted-foreground mt-1">
                    <span>Calibration</span>
                    <span>${p.weight}</span>
                  </div>
                  <div class="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-border/60">
                    <div class="h-full ${barColor} transition-all duration-700" style="width: ${p.score}%"></div>
                  </div>
                  <p class="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">${p.detail}</p>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="mt-12 grid gap-6 md:grid-cols-2">
          <div class="rounded-sm border border-positive/40 bg-positive/5 p-6">
            <div class="flex items-center gap-2">
              <span class="flex h-5 w-5 items-center justify-center rounded-full bg-positive/20 text-positive text-xs">✓</span>
              <h3 class="font-mono text-[11px] uppercase tracking-[0.16em] text-positive font-bold">Key Structural Strength</h3>
            </div>
            <p class="mt-3 text-[14px] leading-relaxed text-foreground">${bank.key_strength}</p>
          </div>

          <div class="rounded-sm border border-negative/40 bg-negative/5 p-6">
            <div class="flex items-center gap-2">
              <span class="flex h-5 w-5 items-center justify-center rounded-full bg-negative/20 text-negative text-xs">!</span>
              <h3 class="font-mono text-[11px] uppercase tracking-[0.16em] text-negative font-bold">Key Vulnerability Risk</h3>
            </div>
            <p class="mt-3 text-[14px] leading-relaxed text-foreground">${bank.key_risk}</p>
          </div>
        </div>

        <!-- Closest Cohort Peers -->
        <div class="mt-12 rounded-sm border border-border bg-card/40 p-6 sm:p-8">
          <div class="flex items-baseline justify-between border-b border-border/60 pb-4 mb-6">
            <div>
              <h2 class="font-display text-2xl text-foreground">Closest Cohort Peer Comparison</h2>
              <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">Institutions with comparable capital or category profile</p>
            </div>
            <a href="#/screener" class="font-mono text-[10px] uppercase text-primary hover:underline">View all in screener →</a>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            ${peers.map(p => `
              <div class="rounded-sm border border-border/80 bg-background/40 p-4 transition-all hover:border-primary/50 hover:bg-card cursor-pointer" onclick="navigateTo('/banks/${p.id}')">
                <div class="flex items-start justify-between">
                  <div>
                    <p class="font-display text-lg text-foreground truncate">${p.name}</p>
                    <p class="font-mono text-[10px] text-muted-foreground uppercase mt-0.5">${p.country} · ${p.ticker}</p>
                  </div>
                  <span class="num text-sm font-semibold ${p.composite >= 63 ? 'text-positive' : p.composite < 44 ? 'text-negative' : 'text-caution'}">
                    ${p.composite}
                  </span>
                </div>
                <div class="mt-3 space-y-1.5 border-t border-border/40 pt-2.5 text-[11px]">
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Assets:</span>
                    <span class="num text-foreground">${formatMoney(p.total_assets_bn)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">ROE:</span>
                    <span class="num text-foreground">${formatPct(p.roe_pct)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">CET1:</span>
                    <span class="num text-foreground">${formatPct(p.cet1_pct)}</span>
                  </div>
                </div>
                <div class="mt-3 pt-2 border-t border-border/40 text-right">
                  <span class="text-primary font-mono text-[10px] uppercase">Compare →</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Bottom Action Strip -->
        <div class="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6">
          <a href="#/screener" class="inline-flex items-center gap-2 rounded-sm border border-border px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-foreground hover:border-primary/40">
            ← Return to Screener
          </a>
          <button type="button" onclick="selectAnalystBank('${bank.id}'); navigateTo('/analyst');" class="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-primary-foreground hover:opacity-90">
            Open in AI Analyst →
          </button>
        </div>
      </div>
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

})();
