export const dashBaseStyles = `
  .dash-root {
    --d-bg: #f4f8ff;
    --d-text: #0a1730;
    --d-muted: #5b6b8c;
    --d-glass: rgba(255,255,255,0.62);
    --d-glass-2: rgba(255,255,255,0.82);
    --d-glass-border: rgba(255,255,255,0.75);
    --d-line: rgba(37,99,235,0.14);
    --d-blue: #2563eb;
    --d-blue-strong: #1546a0;
    --d-cyan: #22d3ee;
    --d-shadow: 0 20px 55px rgba(21,70,160,0.15);
    --d-shadow-hover: 0 30px 70px rgba(21,70,160,0.26);
    --green: #10b981;
    --amber: #f59e0b;
    --red: #ef4444;
    --nav-dark: #121828;
    --nav-dark-border: rgba(255,255,255,0.08);

    position: relative; min-height: 100vh; color: var(--d-text);
    background:
      radial-gradient(900px 500px at 85% -10%, rgba(59,130,246,0.16), transparent 60%),
      radial-gradient(700px 500px at -10% 15%, rgba(34,211,238,0.12), transparent 55%),
      var(--d-bg);
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    line-height: 1.55; overflow-x: hidden;
    transition: background .4s ease, color .4s ease;
  }
  .dash-root.dash-dark {
    --d-bg: #050d22;
    --d-text: #eaf1ff;
    --d-muted: #8da3c9;
    --d-glass: rgba(15,30,62,0.55);
    --d-glass-2: rgba(12,24,52,0.72);
    --d-glass-border: rgba(80,130,230,0.22);
    --d-line: rgba(120,160,255,0.14);
    --d-blue: #4f8bff;
    --d-blue-strong: #6ea2ff;
    --d-cyan: #22d3ee;
    --d-shadow: 0 22px 60px rgba(0,0,0,0.55);
    --d-shadow-hover: 0 30px 70px rgba(10,40,120,0.6);
    --nav-dark: #0a1020;
    background:
      radial-gradient(900px 520px at 85% -10%, rgba(40,90,220,0.28), transparent 60%),
      radial-gradient(700px 500px at -10% 20%, rgba(34,211,238,0.12), transparent 55%),
      var(--d-bg);
  }
  .dash-root * { box-sizing: border-box; }
  .dash-root h1, .dash-root h2, .dash-root h3, .dash-root h4, .dash-root p { margin: 0; }

  .dash-bg-grid {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image:
      linear-gradient(var(--d-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--d-line) 1px, transparent 1px);
    background-size: 50px 50px;
    -webkit-mask-image: radial-gradient(circle at 50% 0%, black 0%, transparent 78%);
    mask-image: radial-gradient(circle at 50% 0%, black 0%, transparent 78%);
  }
  .dash-orb {
    position: fixed; border-radius: 50%; filter: blur(80px); z-index: 0; opacity: .5;
    pointer-events: none; animation: dorb 16s ease-in-out infinite;
  }
  .dash-orb-1 { width: 420px; height: 420px; background: var(--d-blue); top: -130px; right: -90px; }
  .dash-orb-2 { width: 360px; height: 360px; background: var(--d-cyan); bottom: 4%; left: -110px; animation-delay: -6s; }
  @keyframes dorb { 0%,100% { transform: translate(0,0); } 50% { transform: translate(24px,40px); } }
  .dash-action-toast {
    position: fixed; top: 92px; right: 18px; z-index: 120;
    max-width: min(360px, calc(100vw - 32px)); padding: 13px 16px;
    border-radius: 14px; color: #fff; font-weight: 800; font-size: .9rem;
    box-shadow: 0 18px 45px rgba(6,18,46,0.28); animation: dashtoast .28s ease both;
  }
  .dash-action-toast.success { background: linear-gradient(135deg, #059669, #10b981); }
  .dash-action-toast.error { background: linear-gradient(135deg, #b91c1c, #ef4444); }
  .dash-action-toast.warning { background: linear-gradient(135deg, #b45309, #f59e0b); color: #111827; }
  @keyframes dashtoast { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

  .dash-header {
    position: sticky; top: 0; z-index: 40;
    background: var(--d-glass); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
    border-bottom: 1px solid var(--d-line);
  }
  .dash-header-inner {
    width: min(1240px, 94%); margin: 0 auto; height: 76px;
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
  }
  .dash-logo { display: inline-flex; align-items: center; flex: 0 0 auto; min-width: 0; text-decoration: none; }
  .dash-logo-img {
    display: block; height: 38px; width: 184px;
    max-width: 100%;
    --fx-logo-accent: var(--d-blue);
    --fx-logo-text: var(--d-text);
  }
  .dash-dark .dash-logo-img {
    --fx-logo-accent: var(--d-cyan);
    --fx-logo-text: #eaf1ff;
  }
  .dash-menu-toggle { display: grid; flex-shrink: 0; }
  .dash-header-right { display: flex; align-items: center; gap: 14px; }
  .mt5-pill {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(16,185,129,0.12); color: var(--green);
    border: 1px solid rgba(16,185,129,0.3); padding: 7px 14px; border-radius: 999px;
    font-size: .76rem; font-weight: 700; letter-spacing: .06em;
  }
  .mt5-pill .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); animation: dpulse 1.5s infinite; }
  .mt5-pill.offline {
    background: rgba(239,68,68,0.12); color: var(--red); border-color: rgba(239,68,68,0.3);
  }
  .mt5-pill.offline .dot { background: var(--red); box-shadow: 0 0 8px var(--red); }
  .icon-btn {
    width: 42px; height: 42px; border-radius: 12px; cursor: pointer;
    display: grid; place-items: center; font-size: 1.1rem;
    background: var(--d-glass-2); border: 1px solid var(--d-glass-border); color: var(--d-text);
    transition: transform .2s, box-shadow .2s; position: relative;
  }
  .icon-btn svg { width: 20px; height: 20px; }
  .icon-btn:hover { transform: translateY(-2px); box-shadow: var(--d-shadow); color: var(--d-blue); }
  .notif-dot { position: absolute; top: 9px; right: 10px; width: 8px; height: 8px; background: var(--red); border-radius: 50%; border: 2px solid var(--d-glass-2); }
  .dash-avatar {
    width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center;
    background: linear-gradient(135deg, var(--d-blue), var(--d-blue-strong)); color: #fff;
    font-weight: 800; font-size: .85rem; box-shadow: 0 8px 18px rgba(37,99,235,0.4); cursor: pointer;
  }

  .dash-layout { display: flex; min-height: calc(100vh - 76px); position: relative; z-index: 1; }
  .dash-sidebar {
    display: block; width: min(320px, calc(100vw - 44px)); flex-shrink: 0;
    background: var(--d-glass); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
    border-right: 1px solid var(--d-line); padding: 18px 14px 24px;
    position: fixed; inset: 0 auto 0 0; height: 100dvh; overflow-y: auto;
    z-index: 80; transform: translateX(-105%); transition: transform .28s cubic-bezier(.2,.8,.2,1);
    box-shadow: 24px 0 50px rgba(6,18,46,0.22);
  }
  .dash-sidebar.mobile-open { transform: translateX(0); }
  .dash-sidebar-scrim {
    position: fixed; inset: 0; z-index: 70; border: 0; padding: 0;
    background: rgba(6,18,46,0.48); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    opacity: 0; pointer-events: none; transition: opacity .25s ease;
  }
  .dash-sidebar-scrim.show { opacity: 1; pointer-events: auto; }
  .dash-sidebar-mobile-head {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 2px 2px 18px; margin-bottom: 10px; border-bottom: 1px solid var(--d-line);
  }
  .dash-sidebar-user {
    display: flex; align-items: center; gap: 12px; padding: 12px;
    border-bottom: 1px solid var(--d-line); margin-bottom: 16px;
  }
  .dash-sidebar-avatar {
    width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, var(--d-blue), var(--d-blue-strong));
    display: grid; place-items: center; color: #fff; font-weight: 800; font-size: .85rem;
  }
  .dash-sidebar-name { font-weight: 800; font-size: .95rem; }
  .dash-sidebar-role { font-size: .78rem; color: var(--d-muted); margin-top: 2px; }
  .dash-nav-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .dash-nav-link {
    display: flex; align-items: center; gap: 12px; padding: 11px 14px;
    border-radius: 12px; text-decoration: none; color: var(--d-muted);
    font-weight: 700; font-size: .88rem; transition: background .2s, color .2s;
  }
  .dash-nav-link svg { width: 20px; height: 20px; flex-shrink: 0; }
  .dash-nav-link:hover { background: rgba(37,99,235,0.08); color: var(--d-text); }
  .dash-nav-link.active {
    color: var(--d-blue); background: rgba(37,99,235,0.12);
    border-left: 3px solid var(--d-blue); padding-left: 11px;
  }

  .dash-main {
    flex: 1; width: min(1240px, 100%); max-width: 1240px; margin: 0 auto;
    padding: 34px 3% 40px; display: flex; flex-direction: column; gap: 30px;
  }
  .dash-main.has-mobile-nav { padding-bottom: 40px; }

  .dash-page-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .dash-page-head h1 { font-size: clamp(1.6rem, 3.2vw, 2.4rem); font-weight: 800; letter-spacing: -.5px; }
  .dash-page-head p { color: var(--d-muted); margin-top: 6px; font-size: .95rem; }
  .dash-welcome h1 { font-size: clamp(1.6rem, 3.2vw, 2.2rem); font-weight: 800; letter-spacing: -.5px; }
  .dash-welcome p { color: var(--d-muted); margin-top: 4px; }

  .glass-panel {
    background: var(--d-glass); border: 1px solid var(--d-glass-border);
    backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
    border-radius: 22px; box-shadow: var(--d-shadow);
    transition: box-shadow .3s, border-color .3s;
  }
  .glass-panel:hover { box-shadow: var(--d-shadow-hover); border-color: rgba(37,99,235,0.35); }
  .dash-section-title { font-size: 1.15rem; font-weight: 800; letter-spacing: -.2px; color: var(--d-text); margin-bottom: 16px; }

  .dash-btn {
    display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px;
    border-radius: 12px; font-weight: 700; font-size: .82rem; letter-spacing: .04em;
    cursor: pointer; border: none; font-family: inherit; transition: transform .2s, box-shadow .2s;
  }
  .dash-btn-primary {
    background: linear-gradient(135deg, #4f6fef, var(--d-blue)); color: #fff;
    box-shadow: 0 8px 22px rgba(37,99,235,0.35);
  }
  .dash-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(37,99,235,0.45); }
  .dash-btn-secondary {
    background: transparent; border: 1.5px solid var(--d-blue); color: var(--d-blue);
  }
  .dash-btn-secondary:hover { background: rgba(37,99,235,0.06); }
  .dash-btn:disabled {
    opacity: .55; cursor: not-allowed; transform: none; box-shadow: none;
  }

  .dash-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--d-line); }
  .dash-tab {
    padding: 12px 28px; border: none; background: transparent; cursor: pointer;
    font-weight: 700; font-size: .82rem; letter-spacing: .04em; color: var(--d-muted);
    font-family: inherit; border-radius: 12px 12px 0 0; transition: all .25s; position: relative;
  }
  .dash-tab:hover { background: rgba(255,255,255,0.35); color: var(--d-text); }
  .dash-tab.active {
    color: var(--d-blue); background: rgba(37,99,235,0.08);
    box-shadow: 0 -2px 12px rgba(37,99,235,0.12);
  }
  .dash-tab.active::after {
    content: ""; position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
    background: var(--d-blue); border-radius: 3px 3px 0 0;
    box-shadow: 0 -2px 10px rgba(37,99,235,0.45);
  }

  .dash-filter-bar {
    padding: 18px 20px; border-bottom: 1px solid var(--d-line);
    display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
    background: rgba(255,255,255,0.25);
  }
  .dash-dark .dash-filter-bar { background: rgba(15,30,62,0.35); }
  .dash-search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 280px; }
  .dash-search-wrap svg {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    width: 18px; height: 18px; color: var(--d-muted); pointer-events: none;
  }
  .dash-input, .dash-select {
    width: 100%; padding: 10px 14px; border-radius: 12px; font-family: inherit; font-size: .88rem;
    background: rgba(255,255,255,0.55); border: 1px solid var(--d-glass-border); color: var(--d-text);
    transition: border-color .2s, box-shadow .2s;
  }
  .dash-search-wrap .dash-input { padding-left: 38px; }
  .dash-input:focus, .dash-select:focus {
    outline: none; border-color: var(--d-blue);
    box-shadow: 0 0 0 4px rgba(37,99,235,0.12);
  }
  .dash-select { width: auto; min-width: 150px; cursor: pointer; appearance: none;
    padding-right: 36px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235b6b8c' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }

  .dash-table-wrap { overflow-x: auto; }
  .dash-table { width: 100%; border-collapse: collapse; min-width: 560px; }
  .dash-table thead tr { background: rgba(37,99,235,0.06); border-bottom: 1px solid var(--d-line); }
  .dash-table th {
    padding: 12px 18px; text-align: left; font-size: .68rem; font-weight: 700;
    letter-spacing: .06em; text-transform: uppercase; color: var(--d-muted);
  }
  .dash-table th.right { text-align: right; }
  .dash-table td { padding: 16px 18px; border-bottom: 1px solid var(--d-line); font-size: .9rem; }
  .dash-table td.right { text-align: right; }
  .dash-table tbody tr { transition: background .2s; }
  .dash-table tbody tr:hover { background: rgba(255,255,255,0.35); }
  .dash-dark .dash-table tbody tr:hover { background: rgba(37,99,235,0.08); }
  .dash-empty-cell {
    padding: 28px 18px !important; text-align: center; color: var(--d-muted);
    font-weight: 700;
  }

  .asset-cell { display: flex; align-items: center; gap: 12px; }
  .asset-icon {
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
    display: grid; place-items: center; background: rgba(37,99,235,0.1); color: var(--d-blue);
  }
  .asset-icon svg { width: 17px; height: 17px; }
  .asset-name { font-weight: 800; }

  .type-badge {
    display: inline-flex; padding: 4px 10px; border-radius: 999px;
    font-size: .68rem; font-weight: 800; letter-spacing: .04em;
  }
  .type-badge.buy { color: var(--green); background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25); }
  .type-badge.sell { color: var(--red); background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.22); }
  .pl-win { color: var(--green); font-weight: 800; }
  .pl-loss { color: var(--red); font-weight: 800; }

  .dash-pagination {
    padding: 16px 20px; border-top: 1px solid var(--d-line);
    display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;
    background: rgba(255,255,255,0.15);
  }
  .dash-pagination p { font-size: .85rem; color: var(--d-muted); }
  .dash-pager { display: flex; align-items: center; gap: 4px; }
  .dash-page-btn {
    width: 34px; height: 34px; border-radius: 10px; border: none; cursor: pointer;
    display: grid; place-items: center; font-family: inherit; font-weight: 700; font-size: .85rem;
    background: transparent; color: var(--d-text); transition: background .2s;
  }
  .dash-page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.5); }
  .dash-page-btn.active { background: var(--d-blue); color: #fff; box-shadow: 0 4px 12px rgba(37,99,235,0.35); }
  .dash-page-btn:disabled { opacity: .4; cursor: not-allowed; }

  .ref-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
  .ref-link-card { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
  .ref-link-head { display: flex; align-items: center; gap: 10px; }
  .ref-link-head svg { width: 22px; height: 22px; color: var(--d-blue); padding: 8px; border-radius: 10px; background: rgba(37,99,235,0.1); box-sizing: content-box; }
  .ref-link-head h2 { font-size: 1.1rem; font-weight: 800; }
  .ref-link-box {
    display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    padding: 10px 12px; border-radius: 12px;
    background: rgba(37,99,235,0.06); border: 1px solid var(--d-line);
  }
  .ref-link-input {
    flex: 1; min-width: 180px; background: transparent; border: none;
    font-family: ui-monospace, monospace; font-size: .82rem; color: var(--d-text);
    outline: none;
  }
  .ref-share-row { display: flex; gap: 10px; padding-top: 14px; border-top: 1px solid var(--d-line); }
  .ref-share-btn {
    width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer;
    display: grid; place-items: center; background: rgba(37,99,235,0.08); color: var(--d-muted);
    transition: background .2s, color .2s;
  }
  .ref-share-btn:hover { background: rgba(37,99,235,0.15); color: var(--d-blue); }
  .ref-share-btn svg { width: 18px; height: 18px; }

  .ref-stats { display: grid; grid-template-columns: 1fr; gap: 16px; }
  .ref-stat-card {
    padding: 22px; position: relative; overflow: hidden;
  }
  .ref-stat-card::after {
    content: ""; position: absolute; top: -24px; right: -24px;
    width: 88px; height: 88px; border-radius: 50%; background: rgba(37,99,235,0.06);
  }
  .ref-stat-label { font-size: .72rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--d-muted); margin-bottom: 8px; }
  .ref-stat-value { font-size: 1.6rem; font-weight: 800; letter-spacing: -.5px; }
  .ref-stat-note { margin-top: 4px; color: var(--d-muted); font-size: .82rem; font-weight: 700; }
  .ref-balance-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; position: relative; z-index: 1; }
  .ref-withdraw-btn { flex-shrink: 0; padding: 9px 14px; font-size: .76rem; }
  .ref-stat-badge {
    display: inline-block; margin-left: 8px; font-size: .68rem; font-weight: 700;
    padding: 3px 8px; border-radius: 999px; background: rgba(37,99,235,0.12); color: var(--d-blue);
    vertical-align: middle;
  }

  .status-pill {
    display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
    border-radius: 999px; font-size: .68rem; font-weight: 700;
  }
  .status-pill.active { color: #059669; background: rgba(16,185,129,0.12); }
  .status-pill.pending { color: #d97706; background: rgba(245,158,11,0.12); }
  .status-pill .sdot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .dash-section-head {
    padding: 18px 20px; border-bottom: 1px solid var(--d-line);
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
  }

  @keyframes dpulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
  .reveal { animation: dreveal .6s cubic-bezier(.2,.8,.2,1) both; }
  @keyframes dreveal { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

  @media (min-width: 1024px) {
    .dash-menu-toggle, .dash-sidebar-scrim, .dash-sidebar-mobile-head { display: none; }
    .dash-sidebar {
      width: 260px; padding: 24px 16px;
      position: sticky; top: 76px; height: calc(100vh - 76px);
      transform: none; z-index: 1; box-shadow: none;
    }
    .dash-main.has-mobile-nav { padding-bottom: 40px; }
    .ref-grid { grid-template-columns: 1.4fr 1fr; }
    .ref-stats { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .dash-action-toast {
      top: 84px; left: 50%; right: auto; width: 90vw; max-width: 90vw;
      text-align: center; animation: dashtoastmobile .28s ease both;
    }
    @keyframes dashtoastmobile {
      from { opacity: 0; transform: translate(-50%, -10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    .dash-header-inner { width: min(100% - 24px, 1240px); height: 68px; gap: 10px; }
    .dash-logo-img { width: 112px; height: 26px; }
    .dash-header-right { gap: 8px; margin-left: auto; }
    .dash-header-right .mt5-pill { display: none; }
    .dash-avatar { display: none; }
    .icon-btn { width: 40px; height: 40px; border-radius: 11px; }
    .dash-layout { min-height: calc(100vh - 68px); }
    .dash-main { width: 100%; padding: 24px 16px 34px; gap: 22px; align-items: stretch; }
    .dash-page-head { align-items: center; text-align: center; justify-content: center; }
    .dash-page-head > div { width: 100%; }
    .dash-page-head > div:last-child { justify-content: center !important; }
    .dash-filter-bar { align-items: stretch; }
    .dash-search-wrap, .dash-select { max-width: none; width: 100%; }
    .dash-table { min-width: 520px; }
    .dash-sidebar .dash-logo-img { width: 164px; height: 36px; }
    .dash-sidebar-user { margin-bottom: 14px; }
    .dash-nav-list { gap: 8px; }
    .dash-nav-link { min-height: 48px; padding: 12px 14px; border-radius: 14px; font-size: .92rem; }
    .dash-nav-link.active { padding-left: 11px; }
    .ref-link-card, .ref-stat-card { padding: 20px; }
    .ref-link-box { flex-direction: column; align-items: stretch; }
    .ref-link-input { width: 100%; min-width: 0; }
    .ref-link-box .dash-btn { justify-content: center; }
    .ref-balance-row { flex-direction: column; align-items: stretch; }
    .ref-withdraw-btn { justify-content: center; width: 100%; }
    .dash-section-head { justify-content: center; text-align: center; }
  }
  @media (max-width: 380px) {
    .dash-header-inner { width: min(100% - 18px, 1240px); gap: 6px; }
    .dash-logo-img { width: 92px; height: 22px; }
    .dash-header-right { gap: 6px; }
    .icon-btn { width: 36px; height: 36px; border-radius: 10px; }
    .icon-btn svg { width: 18px; height: 18px; }
  }
  @media (min-width: 720px) {
    .ref-stats { grid-template-columns: 1fr 1fr; }
  }
`

export const dashDashboardStyles = `
  .mt5-card {
    padding: 26px; display: grid; gap: 22px;
    grid-template-columns: 0.85fr 1.4fr 1.15fr; grid-template-areas: "left center balance" "sync sync sync";
    position: relative; overflow: hidden;
  }
  .mt5-card::before {
    content: ""; position: absolute; inset: 0; border-radius: 22px; padding: 1px; pointer-events: none;
    background: linear-gradient(135deg, rgba(79,139,255,0.5), transparent 40%, transparent 60%, rgba(34,211,238,0.4));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude; opacity: .8;
  }
  .mt5-left { grid-area: left; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 8px; border-right: 1px solid var(--d-line); }
  .holo-ring { position: relative; width: 132px; height: 132px; display: grid; place-items: center; }
  .holo-ring-spin {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid transparent; border-top-color: var(--d-blue); border-right-color: var(--d-cyan);
    animation: hospin 4s linear infinite; filter: drop-shadow(0 0 6px rgba(79,139,255,0.5));
  }
  .holo-ring-spin.slow { inset: 12px; border-top-color: var(--d-cyan); border-left-color: var(--d-blue); animation-duration: 7s; animation-direction: reverse; opacity: .6; }
  .holo-core {
    width: 88px; height: 88px; border-radius: 50%; display: grid; place-items: center;
    background: radial-gradient(circle at 30% 30%, rgba(79,139,255,0.25), rgba(34,211,238,0.12));
    border: 1px solid var(--d-glass-border); box-shadow: inset 0 0 22px rgba(79,139,255,0.35), 0 0 26px rgba(79,139,255,0.3);
    font-weight: 800; letter-spacing: -1px;
  }
  .holo-core .holo-mt { font-size: 1.5rem; color: var(--d-text); }
  .holo-core .holo-5 {
    font-size: 1.5rem;
    background: linear-gradient(135deg, var(--d-blue), var(--d-cyan));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  @keyframes hospin { to { transform: rotate(360deg); } }
  .status-badge {
    display: inline-flex; align-items: center; gap: 8px; font-size: .72rem; font-weight: 800; letter-spacing: .06em;
    padding: 7px 14px; border-radius: 999px;
  }
  .status-badge.connected { color: var(--green); background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); }
  .status-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; animation: dpulse 1.6s infinite; }
  .mt5-center { grid-area: center; padding: 4px 6px; }
  .mt5-title { font-size: 1.35rem; font-weight: 800; letter-spacing: -.4px; }
  .mt5-sub { color: var(--d-muted); font-size: .92rem; margin-top: 4px; margin-bottom: 18px; }
  .mt5-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
  .mt5-info-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 0; border-bottom: 1px solid var(--d-line); }
  .mt5-info-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--d-muted); font-weight: 600; }
  .mt5-info-value { font-size: .98rem; font-weight: 700; color: var(--d-text); }
  .mt5-balance {
    grid-area: balance; padding: 22px; border-radius: 18px;
    background: linear-gradient(160deg, rgba(37,99,235,0.1), rgba(34,211,238,0.06));
    border: 1px solid var(--d-glass-border); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 12px 30px rgba(21,70,160,0.12);
    display: flex; flex-direction: column; gap: 18px;
  }
  .dash-dark .mt5-balance { box-shadow: inset 0 1px 0 rgba(120,160,255,0.12), 0 14px 34px rgba(0,0,0,0.4); }
  .balance-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; color: var(--d-muted); font-weight: 700; }
  .balance-value {
    display: block; margin-top: 6px; font-size: 2.3rem; font-weight: 800; letter-spacing: -1px; line-height: 1.1;
    background: linear-gradient(135deg, var(--d-blue-strong), var(--d-blue) 55%, var(--d-cyan));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .balance-value small { font-size: .9rem; font-weight: 700; -webkit-text-fill-color: var(--d-muted); }
  .balance-sub { display: grid; gap: 12px; }
  .bal-stat { display: flex; justify-content: space-between; align-items: baseline; padding-top: 12px; border-top: 1px solid var(--d-line); }
  .bal-stat-label { font-size: .82rem; color: var(--d-muted); font-weight: 600; }
  .bal-stat-value { font-size: 1.02rem; font-weight: 800; letter-spacing: -.3px; }
  .bal-stat-value small { font-size: .68rem; font-weight: 700; opacity: .7; }
  .bal-stat-value.equity { color: var(--d-blue); }
  .bal-stat-value.margin { color: var(--d-cyan); }
  .bal-stat-value.profit { color: var(--green); }
  .sync-bar {
    grid-area: sync; display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 14px 20px; border-radius: 16px;
    background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25);
  }
  .sync-bar-left { display: flex; align-items: center; gap: 12px; }
  .sync-pulse { width: 12px; height: 12px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 0 rgba(16,185,129,0.6); animation: sring 1.8s infinite; }
  @keyframes sring { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); } 70% { box-shadow: 0 0 0 12px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
  .sync-text { font-weight: 700; color: var(--green); font-size: .92rem; }
  .sync-graph { width: 180px; height: 36px; color: var(--green); opacity: .85; }
  .bot-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .bot-card {
    padding: 24px; display: flex; flex-direction: column; gap: 14px; min-height: 240px;
    transition: transform .3s, box-shadow .3s; position: relative; overflow: hidden;
  }
  .bot-card:hover { transform: translateY(-6px); box-shadow: var(--d-shadow-hover); }
  .bot-card::after { content: ""; position: absolute; top: -60px; right: -60px; width: 150px; height: 150px; border-radius: 50%; filter: blur(50px); opacity: .5; }
  .state-active::after { background: var(--green); }
  .state-pause::after { background: var(--amber); }
  .state-offline::after { background: var(--red); }
  .state-active { border-color: rgba(16,185,129,0.35); }
  .state-pause { border-color: rgba(245,158,11,0.35); }
  .state-offline { border-color: rgba(239,68,68,0.35); }
  .bot-card-head { display: flex; align-items: center; justify-content: space-between; }
  .bot-icon { position: relative; width: 58px; height: 58px; border-radius: 16px; display: grid; place-items: center; }
  .bot-icon svg { width: 30px; height: 30px; z-index: 1; }
  .bot-icon-ring { position: absolute; inset: 0; border-radius: 16px; border: 1.5px solid currentColor; opacity: .4; }
  .state-active .bot-icon { color: var(--green); background: rgba(16,185,129,0.1); box-shadow: 0 0 22px rgba(16,185,129,0.35); }
  .state-pause .bot-icon { color: var(--amber); background: rgba(245,158,11,0.1); box-shadow: 0 0 22px rgba(245,158,11,0.32); }
  .state-offline .bot-icon { color: var(--red); background: rgba(239,68,68,0.1); box-shadow: 0 0 22px rgba(239,68,68,0.3); }
  .bot-badge { display: inline-flex; align-items: center; gap: 7px; font-size: .72rem; font-weight: 800; letter-spacing: .05em; }
  .bot-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; animation: dpulse 1.6s infinite; }
  .state-active .bot-badge { color: var(--green); }
  .state-pause .bot-badge { color: var(--amber); }
  .state-offline .bot-badge { color: var(--red); }
  .bot-title { font-size: 1.1rem; font-weight: 800; }
  .bot-desc { color: var(--d-muted); font-size: .9rem; flex-grow: 1; }
  .bot-btn {
    width: 100%; padding: 13px; border-radius: 12px; border: none; cursor: pointer;
    font-weight: 800; font-size: .82rem; letter-spacing: .05em; font-family: inherit; color: #fff;
    transition: transform .2s, box-shadow .2s, filter .2s;
  }
  .state-active .bot-btn { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 10px 24px rgba(16,185,129,0.4); }
  .state-pause .bot-btn { background: linear-gradient(135deg, #f59e0b, #d97706); box-shadow: 0 10px 24px rgba(245,158,11,0.4); }
  .state-offline .bot-btn { background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 10px 24px rgba(239,68,68,0.4); }
  .bot-btn:not(.locked):hover { transform: translateY(-2px); filter: brightness(1.05); }
  .bot-btn.locked { cursor: not-allowed; opacity: .92; }
  .bot-btn .lock { margin-right: 7px; }
  .sync-grid { padding: 22px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
  .sync-block { display: flex; gap: 14px; align-items: flex-start; padding: 6px; border-radius: 14px; }
  .sync-block + .sync-block { border-left: 1px solid var(--d-line); padding-left: 18px; }
  .sync-block-icon { width: 42px; height: 42px; border-radius: 12px; flex: 0 0 42px; display: grid; place-items: center; color: var(--d-blue); background: rgba(37,99,235,0.1); }
  .sync-block-icon svg { width: 22px; height: 22px; }
  .sync-block-icon.health-icon { color: var(--green); background: rgba(16,185,129,0.12); }
  .sync-block > div { display: flex; flex-direction: column; gap: 3px; }
  .sync-block-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: var(--d-muted); font-weight: 600; }
  .sync-block-value { font-size: 1rem; font-weight: 800; color: var(--d-text); }
  .sync-block-note { font-size: .8rem; color: var(--d-muted); font-weight: 600; }
  .health-badge { display: inline-block; width: fit-content; padding: 3px 12px; border-radius: 999px; font-size: .82rem; font-weight: 800; margin-top: 2px; }
  .health-badge.excellent { color: var(--green); background: rgba(16,185,129,0.14); border: 1px solid rgba(16,185,129,0.3); }
  .health-bars { display: flex; gap: 4px; margin-top: 7px; }
  .health-bars span { width: 22px; height: 6px; border-radius: 3px; background: var(--d-line); }
  .health-bars span.on { background: var(--green); box-shadow: 0 0 8px rgba(16,185,129,0.5); }
  .perf-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 24px; }
  .chart-card { padding: 22px; display: flex; flex-direction: column; }
  .chart-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .chart-tag { font-size: .8rem; font-weight: 800; color: var(--green); background: rgba(16,185,129,0.12); padding: 5px 12px; border-radius: 999px; }
  .chart-body { position: relative; flex-grow: 1; min-height: 220px; border-radius: 14px; overflow: hidden; }
  .chart-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .chart-dot { position: absolute; top: 14%; right: 1%; width: 12px; height: 12px; border-radius: 50%; background: var(--d-bg); border: 3px solid var(--d-blue); box-shadow: 0 0 12px var(--d-blue); }
  .ops-card { padding: 22px; }
  .ops-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .ops-link { background: none; border: none; cursor: pointer; color: var(--d-blue); font-weight: 700; font-size: .85rem; font-family: inherit; }
  .ops-table { display: flex; flex-direction: column; }
  .ops-row { display: grid; grid-template-columns: 1fr auto auto; gap: 14px; align-items: center; padding: 13px 0; border-bottom: 1px solid var(--d-line); }
  .ops-row:last-child { border-bottom: none; }
  .ops-cell { display: flex; flex-direction: column; }
  .ops-pair { font-weight: 800; font-size: .92rem; }
  .ops-date { font-size: .76rem; color: var(--d-muted); }
  .ops-type { font-size: .72rem; font-weight: 800; padding: 4px 10px; border-radius: 7px; letter-spacing: .04em; }
  .ops-type.buy { color: var(--d-blue); background: rgba(37,99,235,0.12); }
  .ops-type.sell { color: var(--red); background: rgba(239,68,68,0.12); }
  .ops-amount { font-weight: 800; font-size: .92rem; text-align: right; min-width: 72px; }
  .ops-amount.win { color: var(--green); }
  .ops-amount.loss { color: var(--red); }

  @media (max-width: 1000px) {
    .mt5-card { grid-template-columns: 1fr 1fr; grid-template-areas: "left center" "balance balance" "sync sync"; }
    .mt5-left { border-right: none; border-bottom: 1px solid var(--d-line); padding-bottom: 18px; }
    .perf-grid { grid-template-columns: 1fr; }
    .sync-grid { grid-template-columns: repeat(2, 1fr); }
    .sync-block:nth-child(3) { border-left: none; padding-left: 6px; }
  }
  @media (max-width: 720px) {
    .bot-grid { grid-template-columns: 1fr; }
    .mt5-card {
      padding: 14px 16px; gap: 12px;
      grid-template-columns: auto 1fr;
      grid-template-areas: "left balance" "sync sync";
    }
    .mt5-left {
      flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; padding: 0; border-right: none; border-bottom: none;
    }
    .mt5-center { display: none; }
    .holo-ring { width: 64px; height: 64px; }
    .holo-ring-spin.slow { inset: 6px; }
    .holo-core { width: 44px; height: 44px; box-shadow: inset 0 0 12px rgba(79,139,255,0.35), 0 0 14px rgba(79,139,255,0.3); }
    .holo-core .holo-mt, .holo-core .holo-5 { font-size: .78rem; }
    .status-badge { font-size: .58rem; padding: 4px 8px; gap: 5px; white-space: nowrap; }
    .status-badge .dot { width: 6px; height: 6px; }
    .mt5-balance {
      padding: 10px 12px; gap: 0; border-radius: 14px;
      align-self: center; min-width: 0;
    }
    .balance-value { font-size: 1.35rem; margin-top: 2px; }
    .balance-value small { font-size: .72rem; }
    .balance-label { font-size: .62rem; }
    .balance-sub { display: none; }
    .sync-grid { grid-template-columns: 1fr; }
    .sync-block + .sync-block { border-left: none; padding-left: 6px; border-top: 1px solid var(--d-line); padding-top: 16px; }
    .mt5-pill { display: none; }
    .sync-bar { padding: 10px 14px; border-radius: 12px; }
    .sync-text { font-size: .78rem; }
    .sync-graph { width: 96px; height: 28px; }
  }

  .mt5-empty {
    min-height: 280px; display: flex; align-items: center; justify-content: center; padding: 48px 24px;
  }
  .mt5-add-btn {
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    background: none; border: 2px dashed rgba(37,99,235,0.35); border-radius: 20px;
    width: min(260px, 100%); padding: 48px 32px; cursor: pointer; font-family: inherit; color: var(--d-text);
    transition: transform .2s, border-color .2s, background .2s;
  }
  .mt5-add-btn:hover {
    transform: translateY(-4px); border-color: var(--d-blue);
    background: rgba(37,99,235,0.06);
  }
  .mt5-add-icon {
    width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center;
    font-size: 2.4rem; font-weight: 300; color: var(--d-blue);
    background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.25);
  }
  .mt5-add-label { font-size: 1.1rem; font-weight: 800; letter-spacing: .06em; }
  .mt5-add-hint { font-size: .88rem; color: var(--d-muted); font-weight: 600; }
  .mt5-loading { padding: 40px; text-align: center; color: var(--d-muted); font-weight: 700; }
  .status-badge.demo {
    color: var(--amber); background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3);
  }
  .dash-trial-banner {
    margin-top: 10px; font-size: .88rem; font-weight: 700; color: var(--amber);
    background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.25);
    padding: 8px 14px; border-radius: 10px; display: inline-block;
  }
  .bot-grid-single { grid-template-columns: 1fr; max-width: none; }
  .bot-cycle-note { margin-top: 12px; font-size: .88rem; color: var(--d-muted); font-weight: 700; }
  .mt5-modal-scrim {
    position: fixed; inset: 0; z-index: 200; background: rgba(5,13,34,0.55);
    backdrop-filter: blur(6px); display: grid; place-items: center; padding: 20px;
  }
  .mt5-modal { width: min(480px, 100%); max-height: calc(100dvh - 40px); overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
  .mt5-modal-head { display: flex; align-items: center; justify-content: space-between; }
  .mt5-modal-head h3 { font-size: 1.2rem; font-weight: 800; }
  .mt5-modal-sub { color: var(--d-muted); font-size: .9rem; }
  .mt5-modal-alert {
    padding: 12px 14px; border-radius: 12px; font-size: .88rem; font-weight: 600;
    color: var(--amber); background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.25);
  }
  .mt5-modal-form { display: flex; flex-direction: column; gap: 14px; }
  .mt5-modal-form label { display: flex; flex-direction: column; gap: 6px; }
  .mt5-modal-form label span { font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--d-muted); }
  .mt5-modal-form input {
    padding: 12px 14px; border-radius: 12px; border: 1px solid var(--d-line);
    background: var(--d-glass-2); color: var(--d-text); font-family: inherit; font-size: .95rem;
  }
  .mt5-modal-hint { font-size: .8rem; color: var(--d-muted); background: var(--d-glass-2); border: 1px solid var(--d-line); border-radius: 10px; padding: 10px 12px; line-height: 1.5; }
  .mt5-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
  @media (max-width: 720px) {
    .mt5-modal-scrim { padding: 0; place-items: center; }
    .mt5-modal { width: 90vw; max-height: 90dvh; padding: 20px; border-radius: 18px; }
    .mt5-modal-actions { flex-direction: column-reverse; }
    .mt5-modal-actions .dash-btn { width: 100%; justify-content: center; }
  }
`
