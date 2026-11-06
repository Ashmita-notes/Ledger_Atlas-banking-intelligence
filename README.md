# Ledger Atlas — Banking Intelligence for Cross-Border Investors

A pixel-perfect, high-performance replication of **[Ledger Atlas](https://invest-sight.base44.app/)**.

## 🚀 Quick Start

You can run and explore the application in two simple ways:

### Option 1: Direct File Open
Double-click [index.html](file:///c:/Users/USER/Desktop/ML%20and%20AI/Portfolio/index.html) to open the website directly in any web browser (Google Chrome, Microsoft Edge, etc.) without requiring a web server.

### Option 2: Local HTTP Server (Recommended)
Double-click [start_website.bat](file:///c:/Users/USER/Desktop/ML%20and%20AI/Portfolio/start_website.bat) or run:
```bash
python -m http.server 3000
```
Then visit: `http://localhost:3000`

---

## 🏛️ Application Architecture & Features

### 1. 📊 Executive Overview (`#/`)
- **Hero & Portfolio Signals**: Displays the aggregate breakdown of 42 multinational & regional bank balance sheets covering **$56.6T in assets**.
- **Live Market Sentiment Engine**: Semicircular **Bull & Bear Sentiment Gauge** with animated needle, bull/bear odds distribution, and 6 weighted sub-indicators:
  - Live price momentum
  - Earnings guidance trajectory
  - Operating profitability (against 12% benchmark)
  - Solvency buffer & asset quality (CET1 ratio & Gross NPLs)
  - Operating cost efficiency (against 60% line)
  - Sector breadth
- **Conviction Targets**: Top quintile negotiation targets (Saudi National Bank, ICICI Bank, HDFC Bank) with radial score indicators.
- **Vulnerability Watch**: Balance sheets under pressure (Deutsche Bank, Truist Financial, Citizens Financial Group, BNP Paribas).
- **Cohort Comparison**: Dual-bar quantitative comparison between Multinational vs. Regional banking franchises.

### 2. 🔍 Global Bank Screener (`#/screener`)
- Interactive filtering by:
  - **Category**: All, Multinational, Regional
  - **Region**: North America, Europe, Asia-Pacific, Latin America, Middle East & Africa
  - **Verdict**: Negotiation target, Hold & monitor, Loss risk
  - **Fuzzy Search**: Bank name, ticker, city, and country
- Multi-dimensional sorting on 7 metrics (Score, Total Assets, ROE, CET1, Cost-to-income, Forecast Net Income, Market Cap).
- Toggle between **Dense Table View** and **Card Grid View**.

### 3. 🗺️ Spatial Banking Geography (`#/map`)
- Powered by Leaflet with the official **ArcGIS Dark Gray World Canvas** tiles and high-contrast styling.
- Pins scaled dynamically by total asset volume ($B/$T) and colored by analytical verdict:
  - 🟢 **Emerald**: Negotiation target
  - 🟡 **Amber**: Hold & monitor
  - 🔴 **Coral**: Loss risk
- Regional quick-zoom presets (North America, Europe, Asia-Pacific, Middle East & Africa, Latin America).
- Interactive inspection drawer with financial summaries and one-click deep link to full balance-sheet analysis.

### 4. 🤖 AI Banking Analyst (`#/analyst`)
- **Forward-Looking Financial Modeling**:
  - 12-month net income, ROE, CET1, and loan growth projections with delta benchmarks.
  - Three-tiered scenario analysis: **Bull Case**, **Base Case**, and **Bear Case** with probability bars and macroeconomic rationales.
  - Core fundamental drivers and downside risks.
  - Definitive negotiating stance recommendations.
- **Interactive Basel III Liquidity Coverage Ratio (LCR) Calculator**:
  - Interactive inputs for HQLA, 30-Day Outflows, and Inflows.
  - Enforces the Basel III 75% cap rule on cash inflows.
  - Semi-circular LCR dial with 100% regulatory threshold line and net surplus/shortfall readouts.
- **Interrogate the Forecast (Chat Interface)**:
  - Context-aware financial responses to prompts like:
    - *"What breaks this forecast?"*
    - *"Better deal than its closest peer?"*
    - *"How does a 100bp credit shock hit earnings?"*
  - Calculates balance-sheet-specific impairment numbers, margin contractions, and capital impact on the fly.

### 5. 📑 In-Depth Bank Balance Sheet (`#/banks/:id`)
- 14 financial metrics: Total Assets, Market Cap, Revenue, Net Income, ROE, ROA, CET1 ratio, Gross NPL, Cost-to-income, Net Interest Margin (NIM), Loan growth, Dividend yield, P/E, and Credit rating.
- The 4 Pillars of the Ledger Score:
  - Profitability (34%)
  - Capital & Credit (26%)
  - Operating Efficiency (14%)
  - Growth & Outlook (26%)
- Senior analyst memorandum and closest peer comparative matrix.

---

## 🧮 Exact Ledger Scoring Formula

$$\text{Composite} = 0.34 \times \text{Profitability} + 0.26 \times \text{Capital} + 0.14 \times \text{Efficiency} + 0.26 \times \text{Growth}$$

- **Profitability**: $0.65 \times \text{scale}(\text{ROE}, 4\%, 20\%) + 0.35 \times \text{scale}(\text{ROA}, 0.1\%, 1.8\%)$
- **Capital**: $0.60 \times \text{scale}(\text{CET1}, 8\%, 19\%) + 0.40 \times (100 - \text{scale}(\text{NPL}, 0.3\%, 5\%))$
- **Efficiency**: $100 - \text{scale}(\text{Cost-Income}, 32\%, 80\%)$
- **Growth**: $0.50 \times \text{scale}(\text{Loan Growth}, -4\%, 14\%) + 0.50 \times \text{scale}(\text{Forecast NI}, -6\%, 16\%)$

