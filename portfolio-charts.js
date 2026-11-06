/**
 * Investment Portfolio Analysis - Interactive Real-Time Chart Engine
 * Integrates data from:
 *   - Regional investment.ipynb
 *   - MNC's investment portfolio.ipynb
 *   - Frontier.ipynb
 *   - Monte Carlo Simulation.ipynb
 */

(function () {
    'use strict';

    // Global chart instances registry
    const charts = {};

    // Check if PORTFOLIO_DATA is available
    if (typeof PORTFOLIO_DATA === 'undefined') {
        console.error('PORTFOLIO_DATA is not defined. Ensure portfolio-data.js is loaded.');
        return;
    }

    const data = PORTFOLIO_DATA;

    // Harmonious modern color tokens
    const COLORS = {
        primary: '#667eea',
        secondary: '#764ba2',
        dark: '#2c3e50',
        success: '#27ae60',
        warning: '#f39c12',
        danger: '#e74c3c',
        info: '#3498db',
        teal: '#1abc9c',
        purple: '#9b59b6',
        slate: '#64748b'
    };

    // Common Chart.js options
    const defaultChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 750,
            easing: 'easeOutQuart'
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    font: {
                        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                        size: 12
                    },
                    padding: 15
                }
            },
            tooltip: {
                backgroundColor: 'rgba(30, 41, 59, 0.95)',
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
                padding: 12,
                cornerRadius: 8,
                boxPadding: 4
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                ticks: {
                    font: { size: 11 },
                    maxRotation: 45
                }
            },
            y: {
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                ticks: { font: { size: 11 } }
            }
        }
    };

    // Helper: Safely destroy and recreate chart
    function getOrCreateChart(canvasId, config) {
        if (charts[canvasId]) {
            charts[canvasId].destroy();
        }
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element #${canvasId} not found`);
            return null;
        }
        const ctx = canvas.getContext('2d');
        charts[canvasId] = new Chart(ctx, config);
        return charts[canvasId];
    }

    // ==========================================
    // 1. REGIONAL BANKS CHARTS
    // ==========================================
    function initRegionalCharts() {
        const reg = data.regional;
        const tickers = reg.tickers;

        // 1.1 Normalized Performance (Base 100)
        const normDatasets = tickers.map(t => ({
            label: `${t} (${reg.info[t].name.split(' ')[0]})`,
            data: reg.normalized[t],
            borderColor: reg.info[t].color,
            backgroundColor: reg.info[t].color + '15',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.2
        }));

        getOrCreateChart('regionalNormChart', {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: normDatasets
            },
            options: {
                ...defaultChartOptions,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: defaultChartOptions.scales.x,
                    y: {
                        ...defaultChartOptions.scales.y,
                        title: { display: true, text: 'Normalized Price (Base 100 = Jan 2020)' }
                    }
                }
            }
        });

        // 1.2 Price Trends (Actual Prices)
        const priceDatasets = tickers.map(t => ({
            label: t,
            data: reg.prices[t],
            borderColor: reg.info[t].color,
            backgroundColor: reg.info[t].color + '15',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.2
        }));

        getOrCreateChart('regionalPriceChart', {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: priceDatasets
            },
            options: {
                ...defaultChartOptions,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: defaultChartOptions.scales.x,
                    y: {
                        ...defaultChartOptions.scales.y,
                        type: 'logarithmic',
                        title: { display: true, text: 'Closing Price (Log Scale for Cross-Currency)' }
                    }
                }
            }
        });

        // 1.3 Annual Returns Comparison
        const returnLabels = tickers.map(t => `${t}`);
        const returnValues = tickers.map(t => reg.info[t].return);
        const returnColors = tickers.map(t => reg.info[t].color);

        getOrCreateChart('regionalReturnsChart', {
            type: 'bar',
            data: {
                labels: returnLabels,
                datasets: [{
                    label: 'Annual Return (%)',
                    data: returnValues,
                    backgroundColor: returnColors,
                    borderRadius: 6
                }]
            },
            options: {
                ...defaultChartOptions,
                plugins: {
                    ...defaultChartOptions.plugins,
                    legend: { display: false }
                },
                scales: {
                    x: defaultChartOptions.scales.x,
                    y: {
                        ...defaultChartOptions.scales.y,
                        title: { display: true, text: 'Annual Return (%)' }
                    }
                }
            }
        });

        // 1.4 Portfolio Weights & Return Simulation
        initRegionalWeightSimulator();
    }

    function initRegionalWeightSimulator() {
        const reg = data.regional;
        const tickers = reg.tickers;

        // Equal weights initial (25% each on 4 stocks or 16.67% on 6)
        // Notebook highlighted equal weights portfolio return = 18.51%
        const initialWeights = [16.67, 16.67, 16.67, 16.67, 16.67, 16.65];

        const ctx = document.getElementById('regionalWeightsChart');
        if (!ctx) return;

        const weightsChart = getOrCreateChart('regionalWeightsChart', {
            type: 'doughnut',
            data: {
                labels: tickers.map(t => `${t} - ${reg.info[t].name.split('(')[0].trim()}`),
                datasets: [{
                    data: initialWeights,
                    backgroundColor: tickers.map(t => reg.info[t].color),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12 } },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ` ${ctx.label}: ${ctx.raw.toFixed(1)}% weight`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });

        // Setup real-time weight sliders
        const slidersContainer = document.getElementById('regionalSliders');
        if (slidersContainer && !slidersContainer.hasChildNodes()) {
            tickers.forEach((t, i) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'weight-slider-row';
                wrapper.innerHTML = `
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:2px;">
                        <span><strong style="color:${reg.info[t].color}">● ${t}</strong> (${reg.info[t].return}%)</span>
                        <span id="reg_val_${i}">${initialWeights[i].toFixed(1)}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="1" value="${Math.round(initialWeights[i])}" id="reg_slider_${i}" style="width:100%; accent-color:${reg.info[t].color}">
                `;
                slidersContainer.appendChild(wrapper);
            });

            // Sliders listener
            tickers.forEach((_, i) => {
                const slider = document.getElementById(`reg_slider_${i}`);
                slider.addEventListener('input', updateRegionalPortfolioReturn);
            });
        }

        function updateRegionalPortfolioReturn() {
            const rawWeights = tickers.map((_, i) => parseFloat(document.getElementById(`reg_slider_${i}`).value) || 0);
            const total = rawWeights.reduce((a, b) => a + b, 0);
            const normWeights = total > 0 ? rawWeights.map(w => (w / total) * 100) : rawWeights;

            normWeights.forEach((w, i) => {
                const valSpan = document.getElementById(`reg_val_${i}`);
                if (valSpan) valSpan.innerText = `${w.toFixed(1)}%`;
            });

            if (weightsChart) {
                weightsChart.data.datasets[0].data = normWeights.map(w => parseFloat(w.toFixed(1)));
                weightsChart.update();
            }

            // Calculate expected return
            let expectedReturn = 0;
            normWeights.forEach((w, i) => {
                const ticker = tickers[i];
                expectedReturn += (w / 100) * reg.info[ticker].return;
            });

            const returnDisplay = document.getElementById('regCalculatedReturn');
            if (returnDisplay) {
                returnDisplay.innerHTML = `<span style="color:var(--primary); font-size:1.6rem; font-weight:bold;">${expectedReturn.toFixed(2)}%</span> <span style="font-size:0.85rem; color:#666;">Annual Return</span>`;
            }
        }

        // Trigger initial calculation
        updateRegionalPortfolioReturn();
    }

    // ==========================================
    // 2. MNC PORTFOLIO CHARTS
    // ==========================================
    function initMncCharts() {
        const mnc = data.mnc;
        const tickers = mnc.tickers;

        // 2.1 Normalized Performance (Base 100)
        const normDatasets = tickers.map(t => ({
            label: `${t} (${mnc.info[t].name.split(' ')[0]})`,
            data: mnc.normalized[t],
            borderColor: mnc.info[t].color,
            backgroundColor: mnc.info[t].color + '15',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.2
        }));

        getOrCreateChart('mncNormChart', {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: normDatasets
            },
            options: {
                ...defaultChartOptions,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: defaultChartOptions.scales.x,
                    y: {
                        ...defaultChartOptions.scales.y,
                        title: { display: true, text: 'Normalized Price (Base 100 = Jan 2020)' }
                    }
                }
            }
        });

        // 2.2 Price Trends (Actual Prices)
        const priceDatasets = tickers.map(t => ({
            label: t,
            data: mnc.prices[t],
            borderColor: mnc.info[t].color,
            backgroundColor: mnc.info[t].color + '15',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.2
        }));

        getOrCreateChart('mncPriceChart', {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: priceDatasets
            },
            options: {
                ...defaultChartOptions,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: defaultChartOptions.scales.x,
                    y: {
                        ...defaultChartOptions.scales.y,
                        type: 'logarithmic',
                        title: { display: true, text: 'Closing Price (Log Scale)' }
                    }
                }
            }
        });

        // 2.3 Annual Returns Comparison
        const returnLabels = tickers.map(t => `${t}`);
        const returnValues = tickers.map(t => mnc.info[t].return);
        const returnColors = tickers.map(t => mnc.info[t].color);

        getOrCreateChart('mncReturnsChart', {
            type: 'bar',
            data: {
                labels: returnLabels,
                datasets: [{
                    label: 'Annual Return (%)',
                    data: returnValues,
                    backgroundColor: returnColors,
                    borderRadius: 6
                }]
            },
            options: {
                ...defaultChartOptions,
                plugins: {
                    ...defaultChartOptions.plugins,
                    legend: { display: false }
                },
                scales: {
                    x: defaultChartOptions.scales.x,
                    y: {
                        ...defaultChartOptions.scales.y,
                        title: { display: true, text: 'Annual Return (%)' }
                    }
                }
            }
        });

        // 2.4 Risk Breakdown (Diversifiable vs Non-Diversifiable)
        getOrCreateChart('mncRiskChart', {
            type: 'doughnut',
            data: {
                labels: ['Diversifiable Risk (32.52%)', 'Non-Diversifiable Risk (2.71%)'],
                datasets: [{
                    data: [mnc.diversifiable_risk, mnc.non_diversifiable_risk],
                    backgroundColor: ['#667eea', '#e74c3c'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ` ${ctx.label}: ${ctx.raw}% of risk`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // ==========================================
    // 3. EFFICIENT FRONTIER CHARTS & SIMULATOR
    // ==========================================
    let frontierChartInstance = null;

    function initFrontierCharts() {
        const fr = data.frontier;

        // 3.1 Frontier Scatter Plot (1,000 points + Analytical Curve + MVP + Max Sharpe + Live Point)
        const simPoints = fr.simulated_points;
        const curvePoints = fr.analytical_curve.map(p => ({ x: p.x, y: p.y }));

        // Initial live marker at 50/50
        const initialLivePoint = [{
            x: 24.34,
            y: 16.26
        }];

        frontierChartInstance = getOrCreateChart('frontierScatterChart', {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: '1,000 Monte Carlo Portfolios',
                        data: simPoints,
                        backgroundColor: 'rgba(102, 126, 234, 0.25)',
                        borderColor: 'transparent',
                        pointRadius: 2.5,
                        pointHoverRadius: 4,
                        order: 4
                    },
                    {
                        type: 'line',
                        label: 'Efficient Frontier Curve',
                        data: curvePoints,
                        borderColor: '#764ba2',
                        borderWidth: 3,
                        pointRadius: 0,
                        fill: false,
                        tension: 0.1,
                        order: 3
                    },
                    {
                        label: 'Min Variance Portfolio (MVP)',
                        data: [{ x: fr.min_variance.x, y: fr.min_variance.y }],
                        backgroundColor: '#27ae60',
                        borderColor: '#ffffff',
                        borderWidth: 2,
                        pointRadius: 8,
                        pointHoverRadius: 10,
                        pointStyle: 'triangle',
                        order: 1
                    },
                    {
                        label: 'Max Sharpe Portfolio',
                        data: [{ x: fr.max_sharpe.x, y: fr.max_sharpe.y }],
                        backgroundColor: '#f39c12',
                        borderColor: '#ffffff',
                        borderWidth: 2,
                        pointRadius: 8,
                        pointHoverRadius: 10,
                        pointStyle: 'star',
                        order: 1
                    },
                    {
                        label: 'Your Portfolio (Real-Time)',
                        data: initialLivePoint,
                        backgroundColor: '#e74c3c',
                        borderColor: '#ffffff',
                        borderWidth: 3,
                        pointRadius: 10,
                        pointHoverRadius: 12,
                        order: 0
                    }
                ]
            },
            options: {
                ...defaultChartOptions,
                scales: {
                    x: {
                        ...defaultChartOptions.scales.x,
                        title: { display: true, text: 'Expected Annual Volatility (%) - Risk' },
                        min: 15,
                        max: 42
                    },
                    y: {
                        ...defaultChartOptions.scales.y,
                        title: { display: true, text: 'Expected Annual Return (%)' },
                        min: 14.5,
                        max: 18.0
                    }
                },
                plugins: {
                    ...defaultChartOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ` ${ctx.dataset.label}: Risk ${ctx.parsed.x.toFixed(2)}%, Return ${ctx.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                }
            }
        });

        // 3.2 Normalized Comparison: HBCYF vs D05.SI
        const hbcyfNorm = data.mnc.normalized['HBCYF'];
        const d05Norm = data.regional.normalized['D05.SI'];

        getOrCreateChart('frontierNormalizedChart', {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [
                    {
                        label: 'HBCYF (HSBC Holdings ADR)',
                        data: hbcyfNorm,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        tension: 0.2
                    },
                    {
                        label: 'D05.SI (DBS Group Singapore)',
                        data: d05Norm,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        tension: 0.2
                    }
                ]
            },
            options: {
                ...defaultChartOptions,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: defaultChartOptions.scales.x,
                    y: {
                        ...defaultChartOptions.scales.y,
                        title: { display: true, text: 'Normalized Performance (Base 100)' }
                    }
                }
            }
        });

        // Setup Real-Time Frontier Weight Slider
        initFrontierRealtimeSlider();
    }

    function initFrontierRealtimeSlider() {
        const slider = document.getElementById('frontierWeightSlider');
        if (!slider) return;

        const fr = data.frontier;
        const r1 = 0.151188; // HBCYF
        const r2 = 0.173838; // D05.SI
        const var1 = 0.159544;
        const var2 = 0.038829;
        const cov12 = fr.cov; // 0.020712

        function updateFrontierLivePoint() {
            const w1 = parseFloat(slider.value) / 100; // weight HBCYF
            const w2 = 1 - w1;                          // weight D05.SI

            const expectedReturn = (w1 * r1 + w2 * r2) * 100;
            const volatility = Math.sqrt(w1 * w1 * var1 + w2 * w2 * var2 + 2 * w1 * w2 * cov12) * 100;
            const sharpe = (expectedReturn - 2.5) / volatility;

            // Update UI telemetry
            const wHbcyfElem = document.getElementById('frontier_w_hbcyf');
            const wD05Elem = document.getElementById('frontier_w_d05');
            const liveRetElem = document.getElementById('frontier_live_return');
            const liveVolElem = document.getElementById('frontier_live_vol');
            const liveSharpeElem = document.getElementById('frontier_live_sharpe');

            if (wHbcyfElem) wHbcyfElem.innerText = `${(w1 * 100).toFixed(0)}%`;
            if (wD05Elem) wD05Elem.innerText = `${(w2 * 100).toFixed(0)}%`;
            if (liveRetElem) liveRetElem.innerText = `${expectedReturn.toFixed(2)}%`;
            if (liveVolElem) liveVolElem.innerText = `${volatility.toFixed(2)}%`;
            if (liveSharpeElem) liveSharpeElem.innerText = `${sharpe.toFixed(3)}`;

            // Update chart live dataset point
            if (frontierChartInstance && frontierChartInstance.data.datasets[4]) {
                frontierChartInstance.data.datasets[4].data = [{
                    x: parseFloat(volatility.toFixed(2)),
                    y: parseFloat(expectedReturn.toFixed(2))
                }];
                frontierChartInstance.update('none'); // silent update for instant 60fps tracking
            }
        }

        slider.addEventListener('input', updateFrontierLivePoint);
        updateFrontierLivePoint();
    }

    // ==========================================
    // 4. MONTE CARLO SIMULATION CHARTS & ENGINE
    // ==========================================
    let mcChartInstance = null;

    function initMonteCarloCharts() {
        const mc = data.monte_carlo;

        // 4.1 JPM Price Path Forecasts (Preloaded from notebook data)
        renderJpmMonteCarloPaths(mc.jpm.paths, mc.jpm.s0, mc.jpm.intervals);

        // 4.2 Corporate Gross Profit Distribution Histogram
        const corp = mc.corporate;
        getOrCreateChart('mcGrossProfitHistChart', {
            type: 'bar',
            data: {
                labels: corp.labels,
                datasets: [{
                    label: 'Frequency (Monte Carlo 1,000 runs)',
                    data: corp.counts,
                    backgroundColor: 'rgba(102, 126, 234, 0.7)',
                    borderColor: '#667eea',
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                ...defaultChartOptions,
                plugins: {
                    ...defaultChartOptions.plugins,
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ...defaultChartOptions.scales.x,
                        title: { display: true, text: 'Simulated Gross Profit Range ($M)' }
                    },
                    y: {
                        ...defaultChartOptions.scales.y,
                        title: { display: true, text: 'Frequency (Count)' }
                    }
                }
            }
        });

        // 4.3 Setup Interactive Live Monte Carlo Engine
        initLiveMonteCarloSimulator();
    }

    function renderJpmMonteCarloPaths(paths, s0, intervals) {
        // Labels: Day 0, Day 25, Day 50...
        const labels = Array.from({ length: intervals + 1 }, (_, i) => `Day ${i}`);

        // Palette of path colors
        const pathColors = [
            '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12',
            '#1abc9c', '#d35400', '#34495e', '#e67e22', '#27ae60'
        ];

        const datasets = paths.map((p, idx) => ({
            label: `Simulation Path #${idx + 1}`,
            data: p,
            borderColor: pathColors[idx % pathColors.length],
            borderWidth: 1.8,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1
        }));

        mcChartInstance = getOrCreateChart('mcPathsChart', {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                ...defaultChartOptions,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    ...defaultChartOptions.plugins,
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 10, font: { size: 10 } }
                    }
                },
                scales: {
                    x: {
                        ...defaultChartOptions.scales.x,
                        ticks: {
                            maxTicksLimit: 12
                        },
                        title: { display: true, text: 'Trading Days Forecast Horizon' }
                    },
                    y: {
                        ...defaultChartOptions.scales.y,
                        title: { display: true, text: 'Stock Price ($ USD)' }
                    }
                }
            }
        });
    }

    // Standard Normal Generator (Box-Muller)
    function randn_bm() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function initLiveMonteCarloSimulator() {
        const runBtn = document.getElementById('runMcSimBtn');
        if (!runBtn) return;

        runBtn.addEventListener('click', () => {
            const s0 = parseFloat(document.getElementById('mc_input_s0')?.value) || 140;
            const annualDrift = (parseFloat(document.getElementById('mc_input_drift')?.value) || 10) / 100;
            const annualVol = (parseFloat(document.getElementById('mc_input_vol')?.value) || 25) / 100;
            const numDays = parseInt(document.getElementById('mc_input_days')?.value) || 250;
            const numPaths = parseInt(document.getElementById('mc_input_paths')?.value) || 10;

            // Daily drift and daily vol
            const dt = 1 / 252;
            const dailyDrift = (annualDrift - 0.5 * annualVol * annualVol) * dt;
            const dailyVol = annualVol * Math.sqrt(dt);

            const generatedPaths = [];
            const terminalPrices = [];

            for (let i = 0; i < numPaths; i++) {
                const path = [round(s0, 2)];
                let currentPrice = s0;
                for (let t = 1; t <= numDays; t++) {
                    const z = randn_bm();
                    currentPrice = currentPrice * Math.exp(dailyDrift + dailyVol * z);
                    path.push(round(currentPrice, 2));
                }
                generatedPaths.push(path);
                terminalPrices.push(currentPrice);
            }

            // Update chart
            renderJpmMonteCarloPaths(generatedPaths, s0, numDays);

            // Compute summary statistics
            terminalPrices.sort((a, b) => a - b);
            const meanTerminal = terminalPrices.reduce((a, b) => a + b, 0) / numPaths;
            const var5 = terminalPrices[Math.floor(0.05 * numPaths)] || terminalPrices[0];
            const p95 = terminalPrices[Math.floor(0.95 * numPaths)] || terminalPrices[terminalPrices.length - 1];
            const minP = terminalPrices[0];
            const maxP = terminalPrices[terminalPrices.length - 1];

            // Update telemetry
            const meanElem = document.getElementById('mc_stat_mean');
            const varElem = document.getElementById('mc_stat_var');
            const p95Elem = document.getElementById('mc_stat_p95');
            const rangeElem = document.getElementById('mc_stat_range');

            if (meanElem) meanElem.innerText = `$${meanTerminal.toFixed(2)}`;
            if (varElem) varElem.innerText = `$${var5.toFixed(2)}`;
            if (p95Elem) p95Elem.innerText = `$${p95.toFixed(2)}`;
            if (rangeElem) rangeElem.innerText = `$${minP.toFixed(2)} - $${maxP.toFixed(2)}`;
        });
    }

    function round(val, decimals) {
        return Number(Math.round(val + 'e' + decimals) + 'e-' + decimals);
    }

    // ==========================================
    // 5. REGRESSION ANALYSIS & HEATMAP
    // ==========================================
    let regressionChartInstance = null;

    function initRegressionCharts() {
        // 5.1 Volume vs Price Regression Explorer
        setupRegressionExplorer();

        // 5.2 R² & Correlation Heatmap
        setupCorrelationHeatmap();

        // 5.3 Volatility Comparison Across Portfolios
        setupVolatilityComparisonChart();
    }

    function setupRegressionExplorer() {
        const selector = document.getElementById('regTickerSelect');
        if (!selector) return;

        // Populate options if empty
        if (selector.options.length <= 1) {
            selector.innerHTML = `
                <optgroup label="Regional Banks">
                    <option value="D05.SI" selected>D05.SI - DBS Bank (Singapore)</option>
                    <option value="1155.KL">1155.KL - Hong Leong Bank (Malaysia)</option>
                    <option value="BMRI.JK">BMRI.JK - Bank Mandiri (Indonesia)</option>
                    <option value="BBL.BK">BBL.BK - Bangkok Bank (Thailand)</option>
                    <option value="BDOUY">BDOUY - BDO Unibank (Philippines)</option>
                    <option value="VNM">VNM - Vietnam Enterprise (Vietnam)</option>
                </optgroup>
                <optgroup label="MNC Banks">
                    <option value="HBCYF">HBCYF - HSBC Holdings (ADR)</option>
                    <option value="JPM">JPM - JPMorgan Chase & Co.</option>
                    <option value="MUFG">MUFG - Mitsubishi UFJ (Japan)</option>
                    <option value="ANZ.AX">ANZ.AX - ANZ Banking Group (Australia)</option>
                    <option value="1398.HK">1398.HK - ICBC / HSBC Hong Kong</option>
                    <option value="KEBNI-B.ST">KEBNI-B.ST - Kebni / Kookmin Bank</option>
                </optgroup>
            `;
        }

        function loadSelectedRegression() {
            const ticker = selector.value;
            const regData = data.regressions[ticker];
            if (!regData) return;

            // Update stats panel
            const stats = regData.stats;
            const eqElem = document.getElementById('regEquation');
            const r2Elem = document.getElementById('regR2');
            const slopeElem = document.getElementById('regSlope');
            const interceptElem = document.getElementById('regIntercept');
            const tstatElem = document.getElementById('regTStat');
            const pvalElem = document.getElementById('regPVal');
            const staticImg = document.getElementById('regStaticImg');

            if (eqElem) eqElem.innerText = `Price = ${stats.intercept.toFixed(2)} + (${stats.slope.toExponential(2)}) × Volume`;
            if (r2Elem) r2Elem.innerText = `${stats.r2.toFixed(3)}`;
            if (slopeElem) slopeElem.innerText = `${stats.slope.toExponential(3)}`;
            if (interceptElem) interceptElem.innerText = `${stats.intercept.toFixed(2)}`;
            if (tstatElem) tstatElem.innerText = `${stats.t_stat.toFixed(2)}`;
            if (pvalElem) pvalElem.innerText = `${stats.p_val.toFixed(3)}`;

            // Update static notebook image path if present
            if (staticImg) {
                const cleanTicker = ticker.replace('.', '_').replace('-', '_');
                staticImg.src = `assets/images/${stats.category}_reg_${cleanTicker}.png`;
            }

            // Scatter points and OLS Line
            regressionChartInstance = getOrCreateChart('regressionScatterChart', {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            label: `${ticker} Observed Trades (Volume vs Price)`,
                            data: regData.points,
                            backgroundColor: 'rgba(102, 126, 234, 0.4)',
                            borderColor: '#667eea',
                            borderWidth: 1,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            order: 2
                        },
                        {
                            type: 'line',
                            label: `OLS Trendline (R² = ${stats.r2.toFixed(3)})`,
                            data: regData.line,
                            borderColor: '#e74c3c',
                            borderWidth: 3,
                            pointRadius: 0,
                            fill: false,
                            tension: 0,
                            order: 1
                        }
                    ]
                },
                options: {
                    ...defaultChartOptions,
                    scales: {
                        x: {
                            ...defaultChartOptions.scales.x,
                            title: { display: true, text: 'Trading Volume' },
                            ticks: {
                                callback: function (value) {
                                    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
                                    if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
                                    return value;
                                }
                            }
                        },
                        y: {
                            ...defaultChartOptions.scales.y,
                            title: { display: true, text: 'Closing Price' }
                        }
                    }
                }
            });
        }

        selector.addEventListener('change', loadSelectedRegression);
        loadSelectedRegression();
    }

    function setupCorrelationHeatmap() {
        const heatmapContainer = document.getElementById('correlationHeatmap');
        if (!heatmapContainer) return;

        // Render combined / selectable heatmap table
        const mncCorr = data.mnc.correlation;
        const tickers = mncCorr.tickers;
        const matrix = mncCorr.matrix;

        let tableHtml = `<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.85rem;">`;
        tableHtml += `<thead><tr><th style="padding:8px; background:#f1f5f9;">Ticker</th>`;
        tickers.forEach(t => {
            tableHtml += `<th style="padding:8px; background:#f1f5f9; font-weight:bold;">${t}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;

        tickers.forEach((rowTicker, r) => {
            tableHtml += `<tr><td style="padding:8px; font-weight:bold; background:#f8fafc; text-align:left;">${rowTicker}</td>`;
            tickers.forEach((colTicker, c) => {
                const val = matrix[r][c];
                // Color scale: from white (0) to deep purple/blue (1.0)
                const intensity = Math.min(1, Math.max(0, val));
                const bg = r === c ? 'rgba(102, 126, 234, 0.4)' : `rgba(102, 126, 234, ${intensity * 0.5})`;
                const bold = r === c ? 'font-weight:bold;' : '';
                tableHtml += `<td style="padding:8px; background:${bg}; ${bold} border:1px solid #e2e8f0;" title="${rowTicker} vs ${colTicker}: r = ${val.toFixed(4)}, R² = ${(val * val).toFixed(4)}">${val.toFixed(2)}</td>`;
            });
            tableHtml += `</tr>`;
        });
        tableHtml += `</tbody></table></div>`;

        heatmapContainer.innerHTML = tableHtml;
    }

    function setupVolatilityComparisonChart() {
        // Collect all 12 stocks with volatilities
        const items = [];
        data.regional.tickers.forEach(t => {
            items.push({
                ticker: t,
                name: data.regional.info[t].name,
                volatility: data.regional.info[t].volatility,
                category: 'Regional',
                color: '#27ae60' // emerald green for Regional
            });
        });

        data.mnc.tickers.forEach(t => {
            items.push({
                ticker: t,
                name: data.mnc.info[t].name,
                volatility: data.mnc.info[t].volatility,
                category: 'MNC',
                color: '#667eea' // royal purple for MNC
            });
        });

        // Sort ascending by volatility
        items.sort((a, b) => a.volatility - b.volatility);

        getOrCreateChart('volatilityCompChart', {
            type: 'bar',
            data: {
                labels: items.map(it => `${it.ticker} (${it.category})`),
                datasets: [{
                    label: 'Annualized Volatility (%)',
                    data: items.map(it => it.volatility),
                    backgroundColor: items.map(it => it.color),
                    borderRadius: 6
                }]
            },
            options: {
                ...defaultChartOptions,
                plugins: {
                    ...defaultChartOptions.plugins,
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const item = items[ctx.dataIndex];
                                return ` ${item.name}: ${item.volatility}% Volatility (${item.category})`;
                            }
                        }
                    }
                },
                scales: {
                    x: defaultChartOptions.scales.x,
                    y: {
                        ...defaultChartOptions.scales.y,
                        title: { display: true, text: 'Annual Volatility (%)' }
                    }
                }
            }
        });
    }

    // ==========================================
    // 6. MODAL LIGHTBOX FOR NOTEBOOK STATIC PLOTS
    // ==========================================
    function setupModalLightbox() {
        const modal = document.getElementById('plotModal');
        const modalImg = document.getElementById('plotModalImg');
        const modalCaption = document.getElementById('plotModalCaption');
        const closeBtn = document.getElementById('plotModalClose');

        if (!modal || !modalImg) return;

        document.querySelectorAll('[data-view-plot]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const imgSrc = btn.getAttribute('data-view-plot');
                const title = btn.getAttribute('data-plot-title') || 'Notebook Plot';
                modalImg.src = imgSrc;
                if (modalCaption) modalCaption.innerText = title;
                modal.style.display = 'flex';
            });
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // ==========================================
    // 7. INITIALIZATION & TAB SWITCHING RESIZE
    // ==========================================
    function init() {
        // Initialize active tab first (Regional)
        initRegionalCharts();
        setupModalLightbox();

        // Handle tab switches: activate tab, render its charts, and resize
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                const targetContent = document.getElementById(tabId);
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                // Render or update charts for the newly visible tab
                if (tabId === 'viz-regional') {
                    initRegionalCharts();
                } else if (tabId === 'viz-mnc') {
                    initMncCharts();
                } else if (tabId === 'viz-frontier') {
                    initFrontierCharts();
                } else if (tabId === 'viz-montecarlo') {
                    initMonteCarloCharts();
                } else if (tabId === 'viz-regression') {
                    initRegressionCharts();
                }

                setTimeout(() => {
                    Object.values(charts).forEach(ch => {
                        if (ch && typeof ch.resize === 'function') {
                            ch.resize();
                        }
                    });
                }, 50);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
