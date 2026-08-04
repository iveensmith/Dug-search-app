import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search, MapPin, Phone, Star, Clock, ChevronRight, ChevronDown, ShieldCheck,
  Mic, X, ArrowLeft, Route, MessageCircle, Package, Bell, User, Pill,
  AlertTriangle, WifiOff, Check, Send, SlidersHorizontal, Sun, Moon, Info,
  Plus, Heart, Stethoscope, ArrowRight, Trash2, Navigation, ClipboardList,
  List as ListIcon, LayoutGrid, RefreshCw, Ban, Hourglass, TrendingUp, History,
} from "lucide-react";

/* ============================================================================
   MediQuest — v3
   The v1 layout and polish, rebranded emerald, corrected against
   iveensmith/Dug-search-app @ master. No prices anywhere (there is no price
   column). Runs on the current schema with no migrations.

   Signature: the Stock Pulse. Availability is only worth anything if you know
   how fresh it is, so PharmacyResult.stockUpdatedAt is rendered as a
   first-class object on every stock claim in the product.
   ========================================================================== */

const CSS = `
:root{
  --brand-50:#ECFDF5; --brand-100:#D1FAE5; --brand-200:#A7F3D0; --brand-300:#6EE7B7;
  --brand-500:#10B981; --brand-600:#059669; --brand-700:#047857; --brand-900:#064E3B;
  --info-50:#EFF6FF; --info-500:#3B82F6; --info-600:#2563EB;
  --amber-50:#FFFBEB; --amber-500:#F59E0B; --amber-700:#B45309;
  --red-50:#FEF2F2; --red-500:#EF4444; --red-600:#DC2626;

  --bg:#F8FAF9; --surface:#FFFFFF; --surface-2:#F1F5F3; --surface-3:#E4EAE7;
  --ink:#0F172A; --ink-2:#334155; --ink-3:#64748B; --ink-4:#94A3B8;
  --line:#E3E9E6; --line-strong:#C9D3CF;

  --r-sm:12px; --r-md:16px; --r-lg:20px; --r-xl:24px; --r-2xl:28px; --r-pill:999px;
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px;
  --s8:32px; --s10:40px; --s12:48px; --s16:64px; --s20:80px;

  --sh-1:0 1px 2px rgba(15,23,42,.05);
  --sh-2:0 2px 4px rgba(15,23,42,.04), 0 8px 20px -6px rgba(15,23,42,.10);
  --sh-3:0 4px 8px rgba(15,23,42,.05), 0 20px 40px -12px rgba(15,23,42,.16);
  --sh-brand:0 8px 24px -6px rgba(5,150,105,.45);

  --ease:cubic-bezier(.22,1,.36,1);
  --dur:220ms;
}
.mq[data-theme="dark"]{
  --bg:#0A0F0D; --surface:#111917; --surface-2:#18211E; --surface-3:#232F2B;
  --ink:#E7F3EE; --ink-2:#C3D2CC; --ink-3:#8FA39C; --ink-4:#65786F;
  --line:#22302B; --line-strong:#33443E;
  --brand-50:#0C2B22; --brand-100:#123529; --brand-200:#1B4A38;
  --amber-50:#2B2410; --red-50:#301619; --info-50:#15223D;
  --sh-1:0 1px 2px rgba(0,0,0,.45);
  --sh-2:0 2px 4px rgba(0,0,0,.3), 0 8px 20px -6px rgba(0,0,0,.5);
  --sh-3:0 4px 8px rgba(0,0,0,.3), 0 20px 40px -12px rgba(0,0,0,.65);
  --sh-brand:0 8px 24px -6px rgba(5,150,105,.35);
}

.mq *{box-sizing:border-box;}
.mq{
  font-family:Geist,"Geist Sans",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:var(--bg); color:var(--ink); min-height:100vh;
  -webkit-font-smoothing:antialiased; font-size:18px; line-height:1.55;
  transition:background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.mq h1,.mq h2,.mq h3,.mq h4,.mq p{margin:0;}
.mq button{font-family:inherit;}

/* ---- type scale ---- */
.t-hero{font-size:56px; line-height:1.02; letter-spacing:-.035em; font-weight:800;}
.t-h1{font-size:42px; line-height:1.08; letter-spacing:-.03em; font-weight:800;}
.t-h2{font-size:32px; line-height:1.15; letter-spacing:-.025em; font-weight:700;}
.t-h3{font-size:24px; line-height:1.25; letter-spacing:-.018em; font-weight:700;}
.t-body{font-size:18px; line-height:1.55;}
.t-sm{font-size:16px; line-height:1.5;}
.t-xs{font-size:14px; line-height:1.45;}
.t-label{font-size:12px; line-height:1; font-weight:700; letter-spacing:.09em; text-transform:uppercase;}
.dim{color:var(--ink-3);} .dim2{color:var(--ink-2);}
.mono{font-variant-numeric:tabular-nums; font-feature-settings:"tnum";}
@media(max-width:600px){
  .t-hero{font-size:38px;} .t-h1{font-size:30px;} .t-h2{font-size:25px;} .t-h3{font-size:20px;}
  .t-body{font-size:17px;}
}

/* ---- a11y floor ---- */
.mq :focus-visible{outline:3px solid var(--brand-500); outline-offset:3px; border-radius:6px;}
.tap{min-height:48px; min-width:48px;}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}

/* ---- buttons ---- */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;
  min-height:52px; padding:0 24px; border-radius:var(--r-pill); border:1px solid transparent;
  font-size:17px; font-weight:700; cursor:pointer; letter-spacing:-.01em;
  transition:transform 140ms var(--ease), box-shadow var(--dur) var(--ease),
             background var(--dur) var(--ease), border-color var(--dur) var(--ease);}
.btn:active{transform:scale(.968);}
.btn-primary{background:var(--brand-600); color:#fff; box-shadow:var(--sh-brand);}
.btn-primary:hover{background:var(--brand-700); box-shadow:0 10px 30px -6px rgba(5,150,105,.55);}
.btn-secondary{background:var(--brand-50); color:var(--brand-700);}
.btn-secondary:hover{background:var(--brand-100);}
.btn-ghost{background:var(--surface); color:var(--ink); border-color:var(--line); box-shadow:var(--sh-1);}
.btn-ghost:hover{border-color:var(--brand-300); box-shadow:var(--sh-2); color:var(--brand-700);}
.btn-quiet{background:transparent; color:var(--ink-2);}
.btn-quiet:hover{background:var(--surface-2);}
.btn-destructive{background:transparent; color:var(--red-600); border-color:var(--red-500);}
.btn-destructive:hover{background:var(--red-50);}
.btn-sm{min-height:44px; padding:0 18px; font-size:15px;}
.btn-icon{padding:0; width:52px; min-width:52px;}
.btn-icon.btn-sm{width:44px; min-width:44px;}
.btn-block{width:100%;}
.btn:disabled{opacity:.5; cursor:not-allowed; box-shadow:none;}

/* ---- surfaces ---- */
.card{background:var(--surface); border:1px solid var(--line); border-radius:var(--r-xl);
  box-shadow:var(--sh-1); transition:box-shadow var(--dur) var(--ease),
  transform var(--dur) var(--ease), border-color var(--dur) var(--ease);}
.card-lift:hover{transform:translateY(-3px); box-shadow:var(--sh-3); border-color:var(--brand-200);}
.panel{background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg);}
.glass{background:color-mix(in srgb, var(--surface) 74%, transparent);
  backdrop-filter:blur(20px) saturate(180%); -webkit-backdrop-filter:blur(20px) saturate(180%);
  border-bottom:1px solid var(--line);}

/* ---- input ---- */
.field{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:0 18px;
  background:var(--surface); border:1.5px solid var(--line); border-radius:var(--r-md);
  transition:border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);}
.field:focus-within{border-color:var(--brand-500); box-shadow:0 0 0 4px var(--brand-50);}
.field input{flex:1;border:0;background:transparent;font-size:18px;color:var(--ink);outline:none;min-width:0;font-family:inherit;}
.field input::placeholder{color:var(--ink-4);}

/* ---- badges / chips ---- */
.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:var(--r-pill);
  font-size:13px;font-weight:700;letter-spacing:-.005em;}
.b-success{background:var(--brand-50); color:var(--brand-700);}
.b-warning{background:var(--amber-50); color:var(--amber-700);}
.b-danger{background:var(--red-50); color:var(--red-600);}
.b-info{background:var(--info-50); color:var(--info-600);}
.b-neutral{background:var(--surface-2); color:var(--ink-3);}
.b-brand{background:var(--brand-600); color:#fff;}
.chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;
  border-radius:var(--r-pill); background:var(--surface); border:1px solid var(--line);
  font-size:15px;font-weight:600;color:var(--ink-2);cursor:pointer;
  transition:all 160ms var(--ease);}
.chip:hover{border-color:var(--brand-300); color:var(--brand-700); background:var(--brand-50);}
.chip[data-on="true"]{background:var(--brand-600); border-color:var(--brand-600); color:#fff;}

/* ---- SIGNATURE: stock pulse ---- */
.pulse{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 10px;
  border-radius:var(--r-pill); font-size:13px; font-weight:700; letter-spacing:-.005em;}
.pulse .dot{width:8px;height:8px;border-radius:50%;position:relative;flex:none;}
.pulse[data-live="true"] .dot::after{content:"";position:absolute;inset:-4px;border-radius:50%;
  border:2px solid currentColor;opacity:0;animation:ring 2.6s var(--ease) infinite;}
@keyframes ring{0%{transform:scale(.6);opacity:.75}70%{transform:scale(1.5);opacity:0}100%{opacity:0}}
.pulse-fresh{background:var(--brand-50); color:var(--brand-700);} .pulse-fresh .dot{background:var(--brand-500);}
.pulse-aging{background:var(--amber-50); color:var(--amber-700);} .pulse-aging .dot{background:var(--amber-500);}
.pulse-stale{background:var(--surface-2); color:var(--ink-3);} .pulse-stale .dot{background:var(--ink-4);}
.pulse-out{background:var(--red-50); color:var(--red-600);} .pulse-out .dot{background:var(--red-500);}

/* ---- motion ---- */
.rise{animation:rise 420ms var(--ease) both;}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.fade{animation:fade 300ms var(--ease) both;}
@keyframes fade{from{opacity:0}to{opacity:1}}
.pop{animation:pop 260ms var(--ease) both;}
@keyframes pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
.sheet-in{animation:sheetin 320ms var(--ease) both;}
@keyframes sheetin{from{transform:translateY(100%)}to{transform:none}}
.skel{background:linear-gradient(100deg,var(--surface-2) 30%,var(--surface-3) 50%,var(--surface-2) 70%);
  background-size:220% 100%; animation:shim 1.4s linear infinite; border-radius:var(--r-sm);}
@keyframes shim{to{background-position:-220% 0}}
.float{animation:float 3.6s ease-in-out infinite alternate;}
@keyframes float{from{transform:translateY(0)}to{transform:translateY(-8px)}}
@media(prefers-reduced-motion:reduce){
  .mq *,.mq *::after{animation:none!important;transition:none!important;}
}

/* ---- layout ---- */
.wrap{max-width:1140px;margin:0 auto;padding:0 24px;}
.app{max-width:520px;margin:0 auto;padding:0 20px 132px;}
.row{display:flex;align-items:center;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
@media(max-width:860px){.grid3{grid-template-columns:1fr;}}
.hero-grid{display:grid;grid-template-columns:1.12fr .88fr;gap:56px;align-items:center;}
@media(max-width:960px){.hero-grid{grid-template-columns:1fr;gap:40px;}}
.scroll-x{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;}
.scroll-x::-webkit-scrollbar{display:none;}

/* ---- bottom nav ---- */
.tabbar{position:sticky;bottom:0;z-index:40;}
.tabbar-inner{display:grid;grid-template-columns:repeat(4,1fr);max-width:520px;margin:0 auto;
  padding:10px 8px calc(10px + env(safe-area-inset-bottom));}
.tabitem{display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border:0;
  background:transparent;color:var(--ink-4);font-size:11px;font-weight:700;cursor:pointer;
  border-radius:var(--r-md);transition:color 160ms var(--ease);}
.tabitem[data-on="true"]{color:var(--brand-600);}

/* ---- misc ---- */
.divider{height:1px;background:var(--line);border:0;}
.acc{border-bottom:1px solid var(--line);}
.acc summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;
  align-items:center;gap:16px;padding:22px 0;font-weight:700;font-size:19px;min-height:48px;}
.acc summary::-webkit-details-marker{display:none;}
.acc[open] summary .caret{transform:rotate(180deg);}
.caret{transition:transform var(--dur) var(--ease);color:var(--ink-3);flex:none;}
.stripe{background:
  linear-gradient(140deg,var(--brand-50) 0%,transparent 58%),
  radial-gradient(900px 420px at 88% -8%, color-mix(in srgb,var(--brand-500) 16%,transparent), transparent 70%);}
`;

/* ------------------------------------------------ parity with lib/types --- */

/** Verbatim from src/lib/types.ts */
function relativeTime(iso) {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

/** Verbatim from src/lib/types.ts */
const drugLabel = (d) => {
  const base = `${d.genericName} ${d.strength} (${d.form.toLowerCase()})`;
  return d.packSize ? `${base} · ${d.packSize}` : base;
};

/** The one addition. No migration — stockUpdatedAt is already on the wire. */
function stockFreshness(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return { tone: "fresh", live: true, label: `Confirmed ${relativeTime(iso)}` };
  if (mins < 1440) return { tone: "aging", live: true, label: `Confirmed ${relativeTime(iso)}` };
  return { tone: "stale", live: false, label: `Last confirmed ${relativeTime(iso)}` };
}

const ago = (m) => new Date(Date.now() - m * 60000).toISOString();

/* ------------------------------------------------------------------ data -- */

const DRUG = {
  id: "d1", genericName: "Artemether/Lumefantrine",
  brandNames: ["Coartem", "Lonart", "P-Alaxin"],
  strength: "20/120 mg", form: "TABLET", packSize: "24-tablet pack",
};

/** Shape matches PharmacyResult in src/lib/types.ts exactly. */
const RESULTS = [
  { id: "p1", name: "Mercyland Pharmacy", address: "12 Ewet Housing Rd", lga: "Uyo", latitude: 5.03, longitude: 7.92, phone: "+234 803 411 9002", distanceKm: 0.8, stockUpdatedAt: ago(14), open24h: false, opensAt: "07:30", closesAt: "22:00", ratingAvg: 4.6, ratingCount: 38 },
  { id: "p2", name: "GraceCare Pharmacy", address: "5 Oron Road", lga: "Uyo", latitude: 5.04, longitude: 7.93, phone: "+234 806 220 7714", distanceKm: 1.4, stockUpdatedAt: ago(190), open24h: true, opensAt: null, closesAt: null, ratingAvg: 4.2, ratingCount: 11 },
  { id: "p3", name: "Lifespring Chemists", address: "9 Abak Road", lga: "Uyo", latitude: 5.01, longitude: 7.90, phone: "+234 802 918 4460", distanceKm: 3.1, stockUpdatedAt: ago(2900), open24h: false, opensAt: "08:00", closesAt: "20:00", ratingAvg: null, ratingCount: 0 },
];

const RATING_AXES = [
  { key: "availability", label: "Had the drugs", v: 4.8 },
  { key: "service", label: "Service", v: 4.5 },
  { key: "pricing", label: "Fair pricing", v: 4.1 },
  { key: "honesty", label: "Genuine drugs", v: 4.9 },
];

const STATES = ["Akwa Ibom", "Lagos", "Rivers", "Cross River", "FCT Abuja"];
const LGAS = ["Uyo", "Ikot Ekpene", "Eket", "Oron", "Abak"];
const TRUST = ["PCN-verified pharmacies", "Licensed pharmacists", "Stock kept up to date", "Secure & private"];
const QUICK = ["Paracetamol", "Amoxicillin", "Coartem", "Ventolin", "Insulin"];
const RECENT = ["Ciprofloxacin 500 mg", "Zinc + ORS sachets", "Augmentin 625 mg"];
const SUGGEST = [
  { g: "Artemether/Lumefantrine", b: "Coartem, Lonart, P-Alaxin", tag: "Antimalarial" },
  { g: "Amoxicillin", b: "Amoxil, Ampiclox", tag: "Antibiotic" },
  { g: "Amlodipine", b: "Norvasc, Amvasc", tag: "Antihypertensive" },
  { g: "Ascorbic acid", b: "Vitamin C, Ceevit", tag: "Supplement" },
];

/* ------------------------------------------------------------ primitives -- */

const Btn = ({ variant = "primary", size, block, icon: Icon, children, ...p }) => (
  <button className={`btn btn-${variant}${size === "sm" ? " btn-sm" : ""}${block ? " btn-block" : ""}${!children ? " btn-icon" : ""}`} {...p}>
    {Icon && <Icon size={19} strokeWidth={2.4} />}{children}
  </button>
);

const Badge = ({ tone = "neutral", icon: Icon, children }) => (
  <span className={`badge b-${tone}`}>{Icon && <Icon size={13} strokeWidth={2.6} />}{children}</span>
);

const Verified = () => (
  <span className="badge b-success" title="This pharmacy's PCN license has been reviewed and approved">
    <ShieldCheck size={13} strokeWidth={2.6} />Verified
  </span>
);

const OpenStatus = ({ open24h, opensAt, closesAt }) => {
  if (open24h) return <Badge tone="success" icon={Clock}>Open 24 h</Badge>;
  if (!opensAt || !closesAt) return null;
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const [oh, om] = opensAt.split(":").map(Number);
  const [ch, cm] = closesAt.split(":").map(Number);
  const open = now >= oh * 60 + om && now < ch * 60 + cm;
  return open
    ? <Badge tone="success" icon={Clock}>Open till {closesAt}</Badge>
    : <Badge tone="neutral" icon={Clock}>Opens {opensAt}</Badge>;
};

const StockPulse = ({ stockUpdatedAt, outOfStock }) => {
  if (outOfStock) return <span className="pulse pulse-out" data-live="false"><span className="dot" />Out of stock</span>;
  const f = stockFreshness(stockUpdatedAt);
  return <span className={`pulse pulse-${f.tone}`} data-live={f.live}><span className="dot" />{f.label}</span>;
};

const Stars = ({ value, count, size = 15 }) => (
  <span className="row" style={{ gap: 6 }} title={value === null ? "Not yet rated" : `${value.toFixed(1)} out of 5`}>
    <span className="row" style={{ color: "var(--amber-500)", gap: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} strokeWidth={1.6} fill={(value ?? 0) - i >= .5 ? "currentColor" : "none"} />
      ))}
    </span>
    {value !== null && <strong className="t-xs mono" style={{ color: "var(--ink-2)" }}>{value.toFixed(1)}</strong>}
    {count !== undefined && <span className="t-xs dim">{count === 0 ? "No ratings yet" : `(${count})`}</span>}
  </span>
);

const Skel = ({ w = "100%", h = 16, r }) => <div className="skel" style={{ width: w, height: h, borderRadius: r }} />;

const Toast = ({ msg, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return (
    <div role="status" className="pop" style={{
      position: "fixed", left: 16, right: 16, bottom: 104, zIndex: 90, maxWidth: 480, margin: "0 auto",
      background: "var(--ink)", color: "var(--bg)", borderRadius: "var(--r-md)",
      padding: "16px 18px", display: "flex", gap: 12, alignItems: "center", boxShadow: "var(--sh-3)",
    }}>
      <span style={{ background: "var(--brand-500)", borderRadius: 999, padding: 4, display: "flex" }}>
        <Check size={14} color="#fff" strokeWidth={3.5} />
      </span>
      <span className="t-sm" style={{ fontWeight: 600 }}>{msg}</span>
    </div>
  );
};

const Sheet = ({ title, children, onClose }) => (
  <div className="fade" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,20,15,.55)", display: "flex", alignItems: "flex-end" }}>
    <div className="sheet-in" onClick={(e) => e.stopPropagation()} style={{
      background: "var(--surface)", width: "100%", maxWidth: 520, margin: "0 auto",
      borderRadius: "var(--r-2xl) var(--r-2xl) 0 0", padding: "12px 20px 28px", maxHeight: "88vh", overflowY: "auto",
    }}>
      <div style={{ width: 44, height: 5, borderRadius: 999, background: "var(--line-strong)", margin: "0 auto 18px" }} />
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <h3 className="t-h3">{title}</h3>
        <Btn variant="quiet" size="sm" icon={X} onClick={onClose} aria-label="Close" />
      </div>
      {children}
    </div>
  </div>
);

const Logo = () => (
  <span className="row" style={{ gap: 10 }}>
    <span style={{ display: "flex", padding: 8, borderRadius: 12, background: "var(--brand-600)", boxShadow: "var(--sh-brand)" }}>
      <Pill size={20} color="#fff" strokeWidth={2.6} />
    </span>
    <span className="t-h3" style={{ fontSize: 21, letterSpacing: "-.03em" }}>MediQuest</span>
  </span>
);

/* ------------------------------------------------------------- shells ----- */

const AppBar = ({ title, onBack, right }) => (
  <header className="glass" style={{ position: "sticky", top: 0, zIndex: 50, padding: "10px 0" }}>
    <div className="row app" style={{ paddingBottom: 0, gap: 8, minHeight: 56 }}>
      {onBack && <Btn variant="quiet" icon={ArrowLeft} onClick={onBack} aria-label="Go back" />}
      <h2 className="t-h3" style={{ flex: 1, fontSize: 20 }}>{title}</h2>
      {right}
    </div>
  </header>
);

const ScopeBar = ({ state, lga, setState, setLga, precise }) => (
  <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
    <div className="app row" style={{ padding: "10px 20px", gap: 8, flexWrap: "wrap" }}>
      <MapPin size={17} color="var(--brand-600)" strokeWidth={2.4} style={{ flex: "none" }} />
      <select value={state} onChange={(e) => setState(e.target.value)} aria-label="State" style={selStyle}>
        {STATES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <ChevronRight size={14} color="var(--ink-4)" />
      <select value={lga} onChange={(e) => setLga(e.target.value)} aria-label="Local government area" style={selStyle}>
        {LGAS.map((s) => <option key={s}>{s}</option>)}
      </select>
      {!precise && (
        <span className="t-xs dim" style={{ width: "100%", paddingLeft: 25 }}>
          Distances from {lga} centre — turn on location for exact.
        </span>
      )}
    </div>
  </div>
);

const selStyle = {
  border: 0, background: "var(--surface-2)", color: "var(--ink)", fontFamily: "inherit",
  fontSize: 15, fontWeight: 600, padding: "10px 12px", borderRadius: 999, minHeight: 44, cursor: "pointer",
};

const TabBar = ({ tab, go }) => {
  const items = [
    { k: "search", label: "Search", Icon: Search },
    { k: "prescriptions", label: "Prescriptions", Icon: ClipboardList, badge: 1 },
    { k: "history", label: "History", Icon: History },
    { k: "account", label: "Account", Icon: User },
  ];
  return (
    <nav className="tabbar glass" aria-label="Main">
      <div className="tabbar-inner">
        {items.map(({ k, label, Icon, badge }) => (
          <button key={k} className="tabitem tap" data-on={tab === k} onClick={() => go(k)} aria-current={tab === k}>
            <span style={{ position: "relative", display: "flex" }}>
              <Icon size={22} strokeWidth={tab === k ? 2.6 : 2} />
              {badge && (
                <span style={{
                  position: "absolute", top: -4, right: -7, minWidth: 17, height: 17, padding: "0 4px",
                  borderRadius: 999, background: "var(--brand-600)", color: "#fff", fontSize: 10,
                  display: "grid", placeItems: "center", fontWeight: 800,
                }}>{badge}</span>
              )}
            </span>
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
};

/* ------------------------------------------------------------- LANDING ---- */

function Landing({ go }) {
  return (
    <div className="fade">
      <header className="glass" style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <div className="wrap row" style={{ minHeight: 76, gap: 16 }}>
          <div style={{ flex: 1 }}><Logo /></div>
          <Btn variant="quiet" size="sm" onClick={() => go("search")}>Sign in</Btn>
          <Btn size="sm" onClick={() => go("search")}>Find medicine</Btn>
        </div>
      </header>

      <section className="stripe" style={{ padding: "72px 0 80px" }}>
        <div className="wrap hero-grid">
          <div className="rise">
            <span className="badge b-success" style={{ marginBottom: 20 }}>
              <ShieldCheck size={14} strokeWidth={2.6} />PCN-verified pharmacies only
            </span>
            <h1 className="t-hero" style={{ marginBottom: 20 }}>
              Find medicine<br />in stock near you.
            </h1>
            <p className="t-body dim2" style={{ maxWidth: 490, marginBottom: 28 }}>
              Stop walking pharmacy to pharmacy. MediQuest shows which verified
              pharmacies in your LGA have your medicine right now — and the minute
              each one last confirmed its shelf.
            </p>

            <div className="card" style={{ padding: 10, borderRadius: "var(--r-lg)", boxShadow: "var(--sh-2)", marginBottom: 20 }}>
              <div className="row" style={{ gap: 10 }}>
                <div className="field" style={{ border: 0, minHeight: 52 }}>
                  <Search size={22} color="var(--ink-4)" />
                  <input placeholder="Search a medicine, brand or generic…" onFocus={() => go("search")} />
                </div>
                <Btn onClick={() => go("results")}>Search</Btn>
              </div>
            </div>

            <div className="row" style={{ gap: 20, flexWrap: "wrap", marginBottom: 30 }}>
              <Btn variant="quiet" size="sm" icon={Stethoscope} onClick={() => go("prescriptions")}>
                Ask a pharmacist instead
              </Btn>
              <span className="t-xs dim">Free · No account needed to search</span>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {TRUST.map((t) => <Badge key={t} tone="neutral" icon={Check}>{t}</Badge>)}
            </div>
          </div>

          <div className="rise" style={{ animationDelay: "120ms" }}><PhoneMock /></div>
        </div>

        <div className="wrap" style={{ marginTop: 64 }}>
          <p className="t-label dim" style={{ marginBottom: 18 }}>Listing pharmacies across Nigeria</p>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            {["Mercyland Pharmacy", "GraceCare", "Lifespring Chemists", "Uduak Pharmacy", "Vinebranch", "Ikeja Meds"].map((p) => (
              <span key={p} className="badge b-neutral" style={{ padding: "10px 16px", fontSize: 15 }}>{p}</span>
            ))}
            <span className="badge b-success" style={{ padding: "10px 16px", fontSize: 15 }}>+ 118 more</span>
          </div>
        </div>
      </section>

      <section className="wrap" style={{ padding: "88px 0" }}>
        <h2 className="t-h1" style={{ marginBottom: 12 }}>Three steps. Under a minute.</h2>
        <p className="t-body dim" style={{ marginBottom: 44, maxWidth: 580 }}>
          Every listing is timestamped by the pharmacy that holds it.
        </p>
        <div className="grid3">
          {[
            { n: "01", t: "Search your medicine", d: "Generic or brand name — both match as you type, across the whole master list." },
            { n: "02", t: "Compare nearby pharmacies", d: "Verified pharmacies in your LGA, ranked by how recently each confirmed the shelf." },
            { n: "03", t: "Go get it", d: "Route and drive time drawn in-app, or call the counter to check before you set off." },
          ].map((s) => (
            <div key={s.n} className="card card-lift" style={{ padding: 28 }}>
              <span className="mono t-label" style={{ color: "var(--brand-600)" }}>{s.n}</span>
              <h3 className="t-h3" style={{ margin: "14px 0 10px" }}>{s.t}</h3>
              <p className="t-sm dim">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "var(--surface)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "88px 0" }}>
        <div className="wrap grid3">
          {[
            { Icon: ShieldCheck, t: "Verified premises", d: "Every pharmacy is checked against its PCN licence by an admin before a patient can ever see it." },
            { Icon: Star, t: "Rated by patients", d: "Four things people actually judge on: stock, service, fair pricing and genuine drugs." },
            { Icon: Stethoscope, t: "A pharmacist to ask", d: "Send a prescription photo and get it explained by a licensed pharmacist." },
          ].map((b) => (
            <div key={b.t}>
              <span style={{ display: "inline-flex", padding: 14, borderRadius: "var(--r-md)", background: "var(--brand-50)", color: "var(--brand-600)", marginBottom: 18 }}>
                <b.Icon size={26} strokeWidth={2.2} />
              </span>
              <h3 className="t-h3" style={{ marginBottom: 10 }}>{b.t}</h3>
              <p className="t-sm dim">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ padding: "88px 0" }}>
        <h2 className="t-h1" style={{ marginBottom: 44 }}>What people say</h2>
        <div className="grid3">
          {[
            { q: "My son's inhaler ran out at 9pm. Found it on Abak Road in four minutes instead of driving all over Uyo.", n: "Aniekan U.", r: "Parent, Ewet Housing" },
            { q: "I check MediQuest before I write a prescription now. If nothing within 5km stocks it, I write something else.", n: "Dr. Mfon E.", r: "Family physician" },
            { q: "We stopped losing walk-ins to the shop across the road. Our shelf is finally searchable.", n: "Blessing A.", r: "Superintendent pharmacist" },
          ].map((t) => (
            <figure key={t.n} className="card" style={{ padding: 28, margin: 0 }}>
              <div className="row" style={{ gap: 3, marginBottom: 16, color: "var(--amber-500)" }}>
                {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" strokeWidth={1.5} />)}
              </div>
              <blockquote className="t-body" style={{ margin: "0 0 20px", fontWeight: 500 }}>“{t.q}”</blockquote>
              <figcaption className="t-xs dim">
                <strong style={{ color: "var(--ink)", display: "block", fontSize: 15 }}>{t.n}</strong>{t.r}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ padding: "0 24px 88px", maxWidth: 820 }}>
        <h2 className="t-h1" style={{ marginBottom: 28 }}>Questions</h2>
        {[
          { q: "How current is the stock information?", a: "Every result shows when its pharmacy last confirmed that item. Anything past 24 hours drops to “last confirmed” and sorts below fresher listings — it's never presented as a guarantee." },
          { q: "Do you show prices?", a: "No. Pharmacies set their own prices and they move often, so instead patients rate each pharmacy on fair pricing after a visit. Confirm the price at the counter." },
          { q: "Can any shop list on MediQuest?", a: "No. A premises supplies its PCN licence number at registration and stays invisible to patients until an admin approves it." },
          { q: "Does it work outside Akwa Ibom?", a: "Yes. Search is scoped to your state and LGA, so results are always pharmacies you can actually reach." },
        ].map((f) => (
          <details key={f.q} className="acc">
            <summary>{f.q}<ChevronDown className="caret" size={22} /></summary>
            <p className="t-sm dim" style={{ paddingBottom: 24, maxWidth: 660 }}>{f.a}</p>
          </details>
        ))}
      </section>

      <footer style={{ background: "var(--surface)", borderTop: "1px solid var(--line)", padding: "72px 0 40px" }}>
        <div className="wrap">
          <div className="card" style={{ padding: 44, background: "var(--brand-600)", border: 0, borderRadius: "var(--r-2xl)", boxShadow: "var(--sh-brand)", marginBottom: 56 }}>
            <h2 className="t-h1" style={{ color: "#fff", maxWidth: 580, marginBottom: 14 }}>Run a pharmacy? Put your shelf on the map.</h2>
            <p className="t-body" style={{ color: "var(--brand-100)", maxWidth: 540, marginBottom: 28 }}>
              Free to list. Add your stock once, confirm it in a tap, and get found by patients already searching for what you have.
            </p>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <Btn variant="ghost" onClick={() => go("owner")}>Register your pharmacy</Btn>
              <Btn variant="quiet" style={{ color: "#fff" }} onClick={() => go("owner")}>See the dashboard <ArrowRight size={18} /></Btn>
            </div>
          </div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
            <Logo />
            <p className="t-xs dim">MediQuest is not a pharmacy and does not dispense medicine.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const PhoneMock = () => (
  <div className="float" style={{
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 34,
    padding: 14, boxShadow: "var(--sh-3)", maxWidth: 360, marginLeft: "auto",
  }}>
    <div style={{ background: "var(--bg)", borderRadius: 24, padding: 18 }}>
      <p className="t-label dim" style={{ marginBottom: 4 }}>Coartem 20/120 mg</p>
      <p className="t-xs dim" style={{ marginBottom: 14 }}>Uyo, Akwa Ibom</p>
      {RESULTS.map((r, i) => (
        <div key={r.id} className="panel rise" style={{ padding: 14, marginBottom: 10, animationDelay: `${220 + i * 130}ms` }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 9, gap: 8 }}>
            <strong className="t-sm">{r.name}</strong>
            <span className="t-xs dim mono" style={{ fontWeight: 700 }}>{r.distanceKm} km</span>
          </div>
          <StockPulse stockUpdatedAt={r.stockUpdatedAt} />
        </div>
      ))}
    </div>
  </div>
);

/* -------------------------------------------------------------- SEARCH ---- */

function SearchScreen({ go, toast }) {
  const [q, setQ] = useState("");
  const [listening, setListening] = useState(false);
  const matches = q ? SUGGEST.filter((s) => (s.g + s.b).toLowerCase().includes(q.toLowerCase())) : [];

  return (
    <div className="app" style={{ paddingTop: 22 }}>
      <h1 className="t-h1" style={{ marginBottom: 6 }}>What do you need?</h1>
      <p className="t-sm dim" style={{ marginBottom: 22 }}>Brand or generic — both work.</p>

      <div className="row" style={{ gap: 10, marginBottom: 24 }}>
        <div className="field">
          <Search size={22} color="var(--ink-4)" />
          <input value={q} autoFocus onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go(q.toLowerCase().includes("insulin") ? "empty" : "results")}
            placeholder="e.g. Coartem, amoxicillin…" aria-label="Search for a medicine" />
          {q && <Btn variant="quiet" size="sm" icon={X} onClick={() => setQ("")} aria-label="Clear search" />}
        </div>
        <Btn variant={listening ? "primary" : "ghost"} icon={Mic} aria-label="Search by voice"
          onClick={() => { setListening(true); setTimeout(() => { setListening(false); setQ("Coartem"); toast("Heard: “Coartem”"); }, 1200); }} />
      </div>

      {listening && (
        <div className="panel pop" style={{ padding: 20, marginBottom: 22, textAlign: "center", borderColor: "var(--brand-500)" }}>
          <span className="pulse pulse-fresh" data-live="true"><span className="dot" />Listening…</span>
          <p className="t-sm dim" style={{ marginTop: 10 }}>Say the medicine name</p>
        </div>
      )}

      {matches.length > 0 && (
        <div className="panel pop" style={{ overflow: "hidden", marginBottom: 24 }}>
          {matches.map((m, i) => (
            <button key={m.g} onClick={() => go("medicine")} className="tap" style={{
              display: "flex", gap: 14, alignItems: "center", width: "100%", textAlign: "left",
              padding: "16px 18px", background: "transparent", border: 0,
              borderTop: i ? "1px solid var(--line)" : 0, cursor: "pointer", color: "var(--ink)",
            }}>
              <span style={{ display: "flex", padding: 10, borderRadius: 12, background: "var(--brand-50)", color: "var(--brand-600)" }}>
                <Pill size={18} strokeWidth={2.4} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong className="t-sm" style={{ display: "block" }}>{m.g}</strong>
                <span className="t-xs dim" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.b}</span>
              </span>
              <Badge tone="neutral">{m.tag}</Badge>
            </button>
          ))}
        </div>
      )}

      {!q && (
        <>
          <Section title="Recent">
            {RECENT.map((r) => <button key={r} className="chip" onClick={() => go("results")}><Clock size={16} />{r}</button>)}
            <button className="chip" onClick={() => toast("Search history cleared")}><Trash2 size={16} />Clear</button>
          </Section>

          <Section title="Commonly searched in Uyo">
            {QUICK.map((p) => (
              <button key={p} className="chip" onClick={() => go(p === "Insulin" ? "empty" : "results")}>{p}</button>
            ))}
          </Section>

          <button onClick={() => go("prescriptions")} className="card card-lift tap" style={{
            padding: 22, width: "100%", textAlign: "left", marginTop: 28, cursor: "pointer",
            display: "flex", gap: 16, alignItems: "center",
          }}>
            <span style={{ display: "flex", padding: 12, borderRadius: 14, background: "var(--info-50)", color: "var(--info-600)" }}>
              <ClipboardList size={22} strokeWidth={2.3} />
            </span>
            <span style={{ flex: 1 }}>
              <strong className="t-body" style={{ display: "block" }}>Not sure what you need?</strong>
              <span className="t-sm dim">Send a prescription photo to a pharmacist</span>
            </span>
            <ChevronRight size={22} color="var(--ink-4)" />
          </button>
        </>
      )}
    </div>
  );
}

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 26 }}>
    <p className="t-label dim" style={{ marginBottom: 12 }}>{title}</p>
    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>{children}</div>
  </div>
);

/* ------------------------------------------------------------- RESULTS ---- */

function Results({ go, toast, lga }) {
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("smart");
  const [view, setView] = useState("list");
  const [filters, setFilters] = useState(false);
  const [route, setRoute] = useState(null);
  const [rating, setRating] = useState(null);

  useEffect(() => { const t = setTimeout(() => setLoading(false), 1000); return () => clearTimeout(t); }, []);

  const sorted = useMemo(() => [...RESULTS].sort((a, b) =>
    sort === "distance" ? a.distanceKm - b.distanceKm
      : sort === "rating" ? (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0)
        : new Date(b.stockUpdatedAt) - new Date(a.stockUpdatedAt) || a.distanceKm - b.distanceKm
  ), [sort]);

  return (
    <>
      <AppBar title={DRUG.brandNames[0]} onBack={() => go("search")}
        right={<Btn variant="ghost" size="sm" icon={SlidersHorizontal} onClick={() => setFilters(true)} aria-label="Filters" />} />

      <div className="app" style={{ paddingTop: 14 }}>
        <p className="t-sm dim" style={{ marginBottom: 18 }}>{drugLabel(DRUG)}</p>

        <div className="row" style={{ justifyContent: "space-between", marginBottom: 16, gap: 10 }}>
          <p className="t-sm dim">
            <strong style={{ color: "var(--ink)" }}>{RESULTS.length} pharmacies</strong> in {lga}
          </p>
          <div className="row panel" style={{ padding: 3, borderRadius: 999, gap: 2 }}>
            {[["list", ListIcon, "List"], ["map", LayoutGrid, "Map"]].map(([k, Icon, l]) => (
              <button key={k} onClick={() => setView(k)} aria-pressed={view === k} style={{
                display: "flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px",
                borderRadius: 999, border: 0, cursor: "pointer", fontSize: 14, fontWeight: 700,
                background: view === k ? "var(--brand-600)" : "transparent",
                color: view === k ? "#fff" : "var(--ink-3)",
              }}><Icon size={15} />{l}</button>
            ))}
          </div>
        </div>

        {view === "list" && (
          <div className="scroll-x" style={{ marginBottom: 18 }}>
            {[["smart", "Freshest stock"], ["distance", "Nearest"], ["rating", "Best rated"]].map(([k, l]) => (
              <button key={k} className="chip" data-on={sort === k} onClick={() => setSort(k)} style={{ flex: "none" }}>{l}</button>
            ))}
            <button className="chip" style={{ flex: "none" }} onClick={() => setFilters(true)}>Open now</button>
          </div>
        )}

        {loading ? (
          <>
            <p className="t-sm dim" style={{ marginBottom: 16 }}>Checking pharmacies in {lga}…</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="card" style={{ padding: 20, marginBottom: 14 }}>
                <div className="row" style={{ gap: 14, marginBottom: 16 }}>
                  <Skel w={56} h={56} r={16} />
                  <div style={{ flex: 1 }}><Skel w="70%" h={18} /><div style={{ height: 8 }} /><Skel w="45%" h={14} /></div>
                </div>
                <Skel h={44} r={14} />
              </div>
            ))}
          </>
        ) : view === "map" ? (
          <MapView route={route} setRoute={setRoute} />
        ) : (
          <>
            {sorted.map((r, i) => (
              <ResultCard key={r.id} r={r} i={i} go={go} toast={toast}
                onRoute={() => { setRoute(r); setView("map"); }} onRate={() => setRating(r)} />
            ))}
            <div className="panel" style={{ padding: 18, marginTop: 4, display: "flex", gap: 12, background: "var(--info-50)", borderColor: "transparent" }}>
              <Info size={19} color="var(--info-600)" style={{ flex: "none", marginTop: 2 }} />
              <p className="t-sm" style={{ color: "var(--info-600)" }}>
                Pharmacies keep their own stock and hours up to date. Call ahead if a listing hasn't been confirmed today.
              </p>
            </div>
          </>
        )}
      </div>

      {filters && (
        <Sheet title="Filter results" onClose={() => setFilters(false)}>
          <p className="t-label dim" style={{ marginBottom: 12 }}>Distance</p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
            {["Under 1 km", "Under 3 km", "Under 5 km", "Any"].map((d, i) => (
              <button key={d} className="chip" data-on={i === 1}>{d}</button>
            ))}
          </div>
          <p className="t-label dim" style={{ marginBottom: 12 }}>Only show</p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
            {["Open now", "Confirmed today", "Open 24 h", "Rated 4+"].map((d, i) => (
              <button key={d} className="chip" data-on={i < 2}>{d}</button>
            ))}
          </div>
          <Btn block onClick={() => { setFilters(false); toast("Filters applied"); }}>Show {RESULTS.length} results</Btn>
        </Sheet>
      )}

      {rating && <RateDialog p={rating} onClose={() => setRating(null)} toast={toast} />}
    </>
  );
}

function ResultCard({ r, i, go, toast, onRoute, onRate }) {
  const f = stockFreshness(r.stockUpdatedAt);
  return (
    <article className="card card-lift rise" style={{ padding: 20, marginBottom: 14, animationDelay: `${i * 70}ms` }}>
      <div className="row" style={{ gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{
          width: 60, height: 60, flex: "none", borderRadius: 16, background: "var(--brand-50)",
          display: "grid", placeItems: "center", color: "var(--brand-600)",
        }}><Pill size={26} strokeWidth={2.2} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 10, marginBottom: 3 }}>
            <h3 className="t-h3" style={{ fontSize: 19 }}>{r.name}</h3>
            <span className="mono t-sm dim" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{r.distanceKm} km</span>
          </div>
          <p className="t-xs dim" style={{ marginBottom: 10 }}>{r.address} · {r.lga}</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <StockPulse stockUpdatedAt={r.stockUpdatedAt} />
            <Verified />
            <OpenStatus {...r} />
          </div>
        </div>
      </div>

      <button onClick={onRate} className="row tap" style={{
        gap: 10, marginBottom: 14, background: "transparent", border: 0, padding: 0, cursor: "pointer",
      }}>
        <Stars value={r.ratingAvg} count={r.ratingCount} />
        <span className="t-xs" style={{ color: "var(--brand-700)", fontWeight: 700 }}>Rate</span>
      </button>

      {f.tone === "stale" && (
        <p className="t-xs" style={{ color: "var(--amber-700)", marginBottom: 14 }}>
          Not confirmed in over a day — worth calling first.
        </p>
      )}

      <div className="row" style={{ gap: 10 }}>
        <Btn variant="ghost" size="sm" icon={Phone} onClick={() => toast(`Calling ${r.name}`)} aria-label={`Call ${r.name}`} />
        <Btn variant="ghost" size="sm" onClick={() => go("pharmacy")} style={{ flex: 1 }}>Details</Btn>
        <Btn size="sm" icon={Route} onClick={onRoute} style={{ flex: 1.5 }}>Directions</Btn>
      </div>
    </article>
  );
}

function MapView({ route, setRoute }) {
  return (
    <div className="rise">
      <div className="card" style={{ overflow: "hidden", marginBottom: 12 }}>
        <div style={{
          height: 320, position: "relative",
          background: "repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2) 14px,var(--surface-3) 14px,var(--surface-3) 15px)",
        }}>
          {RESULTS.map((r, i) => (
            <button key={r.id} title={r.name} onClick={() => setRoute(r)} aria-label={`Route to ${r.name}`} style={{
              position: "absolute", left: `${22 + i * 26}%`, top: `${28 + i * 17}%`,
              background: route?.id === r.id ? "var(--brand-700)" : "var(--brand-600)",
              color: "#fff", borderRadius: "50% 50% 50% 3px", border: 0, cursor: "pointer",
              width: 38, height: 38, display: "grid", placeItems: "center",
              transform: "rotate(-45deg)", boxShadow: "var(--sh-2)",
            }}><Pill size={16} style={{ transform: "rotate(45deg)" }} /></button>
          ))}
          <span className="badge b-neutral" style={{ position: "absolute", bottom: 10, right: 10, background: "var(--surface)" }}>
            © OpenStreetMap
          </span>
        </div>
        {route ? (
          <div style={{ padding: 20, borderTop: "1px solid var(--line)" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
              <strong className="t-body">{route.name}</strong>
              <span className="t-sm mono dim">{route.distanceKm} km · 9 min drive</span>
            </div>
            <div style={{ marginBottom: 16 }}><StockPulse stockUpdatedAt={route.stockUpdatedAt} /></div>
            <div className="row" style={{ gap: 10 }}>
              <Btn variant="ghost" size="sm" icon={X} onClick={() => setRoute(null)} style={{ flex: 1 }}>Clear route</Btn>
              <Btn variant="secondary" size="sm" icon={Navigation}
                onClick={() => window.open("https://www.google.com/maps", "_blank")} style={{ flex: 1.5 }}>
                Voice navigation
              </Btn>
            </div>
          </div>
        ) : (
          <p className="t-sm dim" style={{ padding: 18, textAlign: "center", borderTop: "1px solid var(--line)" }}>
            Tap a pin to draw the route.
          </p>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- MEDICINE ------- */

function MedicineDetail({ go, toast }) {
  return (
    <>
      <AppBar title="Medicine" onBack={() => go("search")}
        right={<Btn variant="ghost" size="sm" icon={Heart} onClick={() => toast("Saved to your list")} aria-label="Save" />} />
      <div className="app" style={{ paddingTop: 14 }}>
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <div style={{
            height: 140, borderRadius: "var(--r-lg)", background: "var(--brand-50)",
            display: "grid", placeItems: "center", color: "var(--brand-600)", marginBottom: 20,
          }}><Pill size={54} strokeWidth={1.8} /></div>
          <Badge tone="info">Antimalarial · Prescription only</Badge>
          <h1 className="t-h2" style={{ margin: "14px 0 6px" }}>{DRUG.genericName}</h1>
          <p className="t-body dim2" style={{ marginBottom: 20 }}>{DRUG.brandNames.join(" · ")}</p>
          <div className="grid2" style={{ gap: 12 }}>
            <Spec k="Strength" v={DRUG.strength} />
            <Spec k="Form" v={DRUG.form.toLowerCase()} />
            <Spec k="Pack size" v={DRUG.packSize} />
            <Spec k="Stocked by" v={`${RESULTS.length} nearby`} />
          </div>
        </div>

        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          <p className="t-label dim" style={{ marginBottom: 16 }}>Where to get it in Uyo</p>
          {RESULTS.map((r, i) => (
            <button key={r.id} onClick={() => go("pharmacy")} className="tap" style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
              padding: "14px 0", background: "transparent", border: 0,
              borderTop: i ? "1px solid var(--line)" : 0, cursor: "pointer", color: "var(--ink)",
            }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong className="t-sm" style={{ display: "block", marginBottom: 7 }}>{r.name}</strong>
                <StockPulse stockUpdatedAt={r.stockUpdatedAt} />
              </span>
              <span className="t-sm mono dim" style={{ fontWeight: 700 }}>{r.distanceKm} km</span>
              <ChevronRight size={20} color="var(--ink-4)" />
            </button>
          ))}
          <Btn block style={{ marginTop: 18 }} onClick={() => go("results")}>Compare all {RESULTS.length}</Btn>
        </div>

        <div className="panel" style={{ padding: 20, background: "var(--amber-50)", borderColor: "transparent", display: "flex", gap: 14, marginBottom: 22 }}>
          <AlertTriangle size={22} color="var(--amber-700)" style={{ flex: "none", marginTop: 2 }} />
          <div>
            <strong className="t-sm" style={{ color: "var(--amber-700)", display: "block", marginBottom: 4 }}>Prescription required</strong>
            <span className="t-sm" style={{ color: "var(--amber-700)" }}>
              Bring your prescription. The pharmacist will confirm the dose against your weight before dispensing.
            </span>
          </div>
        </div>

        <div>
          <p className="t-label dim" style={{ marginBottom: 12 }}>Same class, stocked nearby</p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {["Artesunate/Amodiaquine", "Dihydroartemisinin/Piperaquine"].map((a) => (
              <button key={a} className="chip" onClick={() => go("results")}>{a}</button>
            ))}
          </div>
          <p className="t-xs dim">Substitutes are not medical advice — confirm with your prescriber or a pharmacist.</p>
        </div>
      </div>
    </>
  );
}

const Spec = ({ k, v }) => (
  <div className="panel" style={{ padding: 14 }}>
    <span className="t-label dim" style={{ display: "block", marginBottom: 6 }}>{k}</span>
    <strong className="t-sm">{v}</strong>
  </div>
);

/* ------------------------------------------------------- ZERO RESULT ------ */

function EmptyResult({ go, toast, state, lga }) {
  const [email, setEmail] = useState("");
  return (
    <>
      <AppBar title="Insulin Glargine" onBack={() => go("search")} />
      <div className="app" style={{ paddingTop: 14 }}>
        <div className="card" style={{ padding: 32, textAlign: "center", marginBottom: 16 }}>
          <span style={{ display: "inline-flex", padding: 18, borderRadius: 20, background: "var(--surface-2)", color: "var(--ink-3)", marginBottom: 20 }}>
            <Search size={30} />
          </span>
          <h3 className="t-h3" style={{ marginBottom: 10 }}>No pharmacy in {lga} lists this yet</h3>
          <p className="t-sm dim">Your search is logged so pharmacies in {lga} can see the demand.</p>
        </div>

        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          <p className="t-label dim" style={{ marginBottom: 14 }}>Available elsewhere in {state}</p>
          <div className="row" style={{ justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
            <div>
              <strong className="t-sm" style={{ display: "block", marginBottom: 7 }}>Ikeja Meds</strong>
              <StockPulse stockUpdatedAt={ago(70)} />
            </div>
            <span className="t-sm mono dim" style={{ fontWeight: 700 }}>142 km</span>
          </div>
          <Btn variant="ghost" block size="sm" onClick={() => go("results")}>See all in {state}</Btn>
        </div>

        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          <p className="t-label dim" style={{ marginBottom: 12 }}>Same class, stocked in {lga}</p>
          {[["Insulin Isophane 100 IU/ml", 2], ["Insulin Glulisine 100 IU/ml", 1]].map(([n, c], i) => (
            <button key={n} onClick={() => go("results")} className="tap" style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              padding: "14px 0", background: "transparent", border: 0, borderTop: "1px solid var(--line)",
              cursor: "pointer", color: "var(--ink)",
            }}>
              <span style={{ flex: 1 }}>
                <strong className="t-sm" style={{ display: "block" }}>{n}</strong>
                <span className="t-xs dim">{c} {c === 1 ? "pharmacy" : "pharmacies"} in {lga}</span>
              </span>
              <ChevronRight size={18} color="var(--ink-4)" />
            </button>
          ))}
          <p className="t-xs dim" style={{ marginTop: 12 }}>
            Substitutes are not medical advice — confirm with your prescriber or a pharmacist.
          </p>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div className="row" style={{ gap: 10, marginBottom: 10 }}>
            <Bell size={20} color="var(--brand-600)" />
            <strong className="t-body">Tell me when it's in stock</strong>
          </div>
          <p className="t-sm dim" style={{ marginBottom: 16 }}>
            We'll email you once a pharmacy in {state} marks it in stock. No account needed.
          </p>
          <div className="field" style={{ marginBottom: 12 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              placeholder="you@example.com" aria-label="Email address" />
          </div>
          <Btn block onClick={() => toast("We'll email you when it's stocked")}>Notify me</Btn>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ PHARMACY ---- */

function PharmacyDetail({ go, toast }) {
  const r = RESULTS[0];
  const [rate, setRate] = useState(false);
  return (
    <>
      <AppBar title={r.name} onBack={() => go("results")} />
      <div className="app" style={{ paddingTop: 14 }}>
        <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
          <div style={{
            height: 170, background: "linear-gradient(135deg,var(--brand-600),var(--brand-900))",
            display: "grid", placeItems: "center", position: "relative",
          }}>
            <MapPin size={44} color="#fff" strokeWidth={1.8} />
            <span className="badge" style={{ position: "absolute", top: 14, left: 14, background: "#fff", color: "var(--brand-700)" }}>
              <ShieldCheck size={13} strokeWidth={2.6} />PCN verified
            </span>
          </div>
          <div style={{ padding: 22 }}>
            <h2 className="t-h2" style={{ fontSize: 26, marginBottom: 10 }}>{r.name}</h2>
            <p className="t-sm dim2" style={{ marginBottom: 4 }}>{r.address}</p>
            <p className="t-sm dim mono" style={{ marginBottom: 16 }}>{r.phone} · {r.distanceKm} km · {r.lga}</p>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              <OpenStatus {...r} />
              <Badge tone="neutral">Hours self-reported</Badge>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Btn size="sm" icon={Route} onClick={() => go("results")} style={{ flex: 1.4 }}>Directions</Btn>
              <Btn variant="ghost" size="sm" icon={Phone} onClick={() => toast(`Calling ${r.phone}`)} aria-label="Call" />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 18, gap: 10 }}>
            <p className="t-label dim">What patients say</p>
            <Stars value={r.ratingAvg} count={r.ratingCount} />
          </div>
          {RATING_AXES.map((a) => (
            <div key={a.key} className="row" style={{ gap: 12, marginBottom: 13 }}>
              <span className="t-sm dim2" style={{ width: 120, flex: "none" }}>{a.label}</span>
              <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(a.v / 5) * 100}%`, background: "var(--brand-500)", borderRadius: 999 }} />
              </span>
              <span className="t-xs mono dim" style={{ width: 26, textAlign: "right" }}>{a.v}</span>
            </div>
          ))}
          <Btn variant="secondary" block size="sm" icon={Star} style={{ marginTop: 16 }} onClick={() => setRate(true)}>
            Rate this pharmacy
          </Btn>
        </div>

        <div className="card" style={{ padding: 22, marginBottom: 16 }}>
          <p className="t-label dim" style={{ marginBottom: 14 }}>Opening hours</p>
          <div className="row" style={{ justifyContent: "space-between", padding: "12px 0" }}>
            <span className="t-sm dim2">Every day</span>
            <span className="t-sm mono" style={{ fontWeight: 600 }}>{r.opensAt} – {r.closesAt}</span>
          </div>
          <p className="t-xs dim">Self-reported by the pharmacy, in Nigerian time.</p>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <p className="t-label dim">In stock here</p>
            <span className="t-xs dim">248 items</span>
          </div>
          {[["Artemether/Lumefantrine 20/120 mg", ago(14), "Coartem"],
            ["Amoxicillin 500 mg", ago(14), "Amoxil"],
            ["Salbutamol inhaler", ago(1600), null]].map(([n, t, brand], i) => (
            <button key={n} onClick={() => go("medicine")} className="tap" style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
              padding: "14px 0", background: "transparent", border: 0,
              borderTop: i ? "1px solid var(--line)" : 0, cursor: "pointer", color: "var(--ink)",
            }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong className="t-sm" style={{ display: "block", marginBottom: 7 }}>{n}</strong>
                <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <StockPulse stockUpdatedAt={t} />
                  {brand && <Badge tone="neutral">Stocks {brand}</Badge>}
                </span>
              </span>
              <ChevronRight size={20} color="var(--ink-4)" />
            </button>
          ))}
          <Btn variant="ghost" block size="sm" style={{ marginTop: 16 }} onClick={() => go("search")}>Search their full list</Btn>
        </div>
      </div>

      {rate && <RateDialog p={r} onClose={() => setRate(false)} toast={toast} />}
    </>
  );
}

function RateDialog({ p, onClose, toast }) {
  const [vals, setVals] = useState({ availability: 0, service: 0, pricing: 0, honesty: 0 });
  const done = Object.values(vals).every((v) => v > 0);
  return (
    <Sheet title={`Rate ${p.name}`} onClose={onClose}>
      <p className="t-sm dim" style={{ marginBottom: 22 }}>
        Rating again updates your previous one rather than adding a new score.
      </p>
      {RATING_AXES.map((a) => (
        <div key={a.key} style={{ marginBottom: 20 }}>
          <p className="t-sm" style={{ fontWeight: 600, marginBottom: 8 }}>{a.label}</p>
          <div className="row" style={{ gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setVals({ ...vals, [a.key]: n })}
                aria-label={`${a.label}: ${n} of 5`} className="tap" style={{
                  border: 0, background: "transparent", cursor: "pointer",
                  color: n <= vals[a.key] ? "var(--amber-500)" : "var(--line-strong)",
                }}>
                <Star size={28} fill={n <= vals[a.key] ? "currentColor" : "none"} strokeWidth={1.6} />
              </button>
            ))}
          </div>
        </div>
      ))}
      <Btn block disabled={!done} onClick={() => { onClose(); toast("Rating saved"); }}>
        {done ? "Save rating" : "Rate all four to save"}
      </Btn>
    </Sheet>
  );
}

/* -------------------------------------------------------- PRESCRIPTIONS --- */

const STATUS = {
  PENDING: { tone: "warning", Icon: Hourglass, patient: "Waiting for a pharmacist", pharmacist: "Unclaimed" },
  CLAIMED: { tone: "info", Icon: User, patient: "A pharmacist is reviewing it", pharmacist: "You claimed this" },
  ANSWERED: { tone: "success", Icon: Check, patient: "Answered", pharmacist: "Answered" },
  CLOSED: { tone: "neutral", Icon: Ban, patient: "Closed", pharmacist: "Closed" },
};

function Prescriptions({ go, toast }) {
  const items = [
    { id: "u1", status: "ANSWERED", note: "What is the yellow one for?", when: ago(2600), unread: 1 },
    { id: "u2", status: "CLAIMED", note: "Can I take these together?", when: ago(180), unread: 0 },
    { id: "u3", status: "PENDING", note: "", when: ago(24), unread: 0 },
  ];
  return (
    <div className="app" style={{ paddingTop: 24 }}>
      <h1 className="t-h1" style={{ marginBottom: 8 }}>Your prescriptions</h1>
      <p className="t-sm dim" style={{ marginBottom: 22 }}>
        Upload a photo and a licensed pharmacist will explain it. Replies usually arrive within a few hours — this isn't a live chat.
      </p>

      <Btn block icon={Plus} style={{ marginBottom: 22 }} onClick={() => toast("Choose a photo")}>
        Upload a prescription
      </Btn>

      {items.map((it) => {
        const s = STATUS[it.status];
        return (
          <button key={it.id} onClick={() => go("thread")} className="card card-lift" style={{
            padding: 18, marginBottom: 14, width: "100%", textAlign: "left", cursor: "pointer",
            display: "flex", gap: 16, alignItems: "center",
          }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: "var(--surface-2)", display: "grid", placeItems: "center", flex: "none", color: "var(--ink-4)" }}>
              <ClipboardList size={24} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="row" style={{ gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <Badge tone={s.tone} icon={s.Icon}>{s.patient}</Badge>
                {it.unread > 0 && <Badge tone="brand">{it.unread} new</Badge>}
              </span>
              <span className="t-sm dim" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.note || "No note added"} · {relativeTime(it.when)}
              </span>
            </span>
            <ChevronRight size={20} color="var(--ink-4)" />
          </button>
        );
      })}

      <div className="panel" style={{ padding: 20, marginTop: 8, background: "var(--amber-50)", borderColor: "transparent", display: "flex", gap: 14 }}>
        <AlertTriangle size={20} color="var(--amber-700)" style={{ flex: "none", marginTop: 2 }} />
        <p className="t-sm" style={{ color: "var(--amber-700)" }}>
          A pharmacist can explain what you've been prescribed. They can't diagnose you or change your prescriber's instructions.
        </p>
      </div>
    </div>
  );
}

function Thread({ go, toast }) {
  const [draft, setDraft] = useState("");
  const msgs = [
    { me: true, t: "The doctor gave me three drugs. What is the yellow one for?", at: ago(2600) },
    { me: false, t: "The yellow tablets are Artemether/Lumefantrine — an antimalarial. Take them twice daily for three days, with food or a little milk so they absorb properly, and finish the full course even if the fever clears.", at: ago(2400) },
  ];
  return (
    <>
      <AppBar title="Prescription" onBack={() => go("prescriptions")}
        right={<Badge tone="success" icon={Check}>Answered</Badge>} />
      <div className="app" style={{ paddingTop: 14 }}>
        <div className="card" style={{ padding: 16, marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ width: 62, height: 78, borderRadius: 12, background: "var(--surface-2)", display: "grid", placeItems: "center", flex: "none", color: "var(--ink-4)" }}>
            <ClipboardList size={24} />
          </span>
          <div style={{ flex: 1 }}>
            <strong className="t-body" style={{ display: "block", marginBottom: 4 }}>Pharm. Ekemini S.</strong>
            <span className="t-xs dim">Claimed {relativeTime(ago(2500))}</span>
          </div>
          <Btn variant="quiet" size="sm" icon={Info} onClick={() => toast("Only you and the claiming pharmacist can open this photo")} aria-label="Privacy" />
        </div>

        {msgs.map((m, i) => (
          <div key={i} className="rise" style={{
            maxWidth: "86%", marginBottom: 12, padding: "14px 18px",
            marginLeft: m.me ? "auto" : 0,
            background: m.me ? "var(--brand-600)" : "var(--surface)",
            color: m.me ? "#fff" : "var(--ink)",
            border: m.me ? 0 : "1px solid var(--line)",
            borderRadius: m.me ? "var(--r-lg) var(--r-lg) 6px var(--r-lg)" : "var(--r-lg) var(--r-lg) var(--r-lg) 6px",
            boxShadow: "var(--sh-1)", animationDelay: `${i * 90}ms`,
          }}>
            <p className="t-sm">{m.t}</p>
            <p className="t-xs" style={{ marginTop: 7, opacity: .65 }}>{relativeTime(m.at)}</p>
          </div>
        ))}

        <div className="row" style={{ gap: 10, marginTop: 20 }}>
          <div className="field" style={{ minHeight: 52 }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a follow-up…" aria-label="Message" />
          </div>
          <Btn icon={Send} onClick={() => { setDraft(""); toast("Sent — you'll get a reply here"); }} aria-label="Send message" />
        </div>
        <p className="t-xs dim" style={{ marginTop: 12, textAlign: "center" }}>
          Replies arrive when a pharmacist is next on duty.
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------ PHARMACIST QUEUE -- */

function PharmacistQueue({ toast }) {
  const q = [
    { id: "u3", note: "", when: ago(24), status: "PENDING" },
    { id: "u5", note: "Is this safe while breastfeeding?", when: ago(95), status: "PENDING" },
    { id: "u2", note: "Can I take these together?", when: ago(180), status: "CLAIMED" },
  ];
  return (
    <div className="app" style={{ paddingTop: 26 }}>
      <h1 className="t-h1" style={{ marginBottom: 8 }}>Claim queue</h1>
      <p className="t-sm dim" style={{ marginBottom: 24 }}>Oldest unclaimed first. Claiming assigns it to you.</p>
      {q.map((it, i) => {
        const s = STATUS[it.status];
        return (
          <div key={it.id} className="card rise" style={{ padding: 20, marginBottom: 14, animationDelay: `${i * 70}ms` }}>
            <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <Badge tone={s.tone} icon={s.Icon}>{s.pharmacist}</Badge>
              <span className="t-xs dim">Uploaded {relativeTime(it.when)}</span>
            </div>
            <p className="t-sm dim2" style={{ marginBottom: 16 }}>{it.note || "No note from the patient"}</p>
            <Btn size="sm" block variant={it.status === "PENDING" ? "primary" : "ghost"}
              onClick={() => toast(it.status === "PENDING" ? "Claimed — it's yours" : "Opening thread")}>
              {it.status === "PENDING" ? "Claim and review" : "Open thread"}
            </Btn>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------- OWNER DASHBOARD - */

function OwnerDash({ toast }) {
  const inv = [
    { n: "Artemether/Lumefantrine 20/120 mg", brand: "Coartem", qty: 34, at: ago(14), inStock: true },
    { n: "Amoxicillin 500 mg", brand: "Amoxil", qty: null, at: ago(14), inStock: true },
    { n: "Salbutamol inhaler", brand: null, qty: 3, at: ago(1600), inStock: true },
    { n: "Paracetamol 500 mg", brand: "Emzor", qty: 0, at: ago(400), inStock: false },
  ];
  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 10 }}>
        <div>
          <p className="t-label dim">Mercyland Pharmacy · Uyo, Akwa Ibom</p>
          <h1 className="t-h1" style={{ marginTop: 8 }}>Inventory</h1>
        </div>
        <Btn icon={RefreshCw} onClick={() => toast("248 items confirmed just now")}>Confirm today's shelf</Btn>
      </div>
      <p className="t-sm dim" style={{ marginBottom: 32, maxWidth: 620 }}>
        Confirming refreshes every item's timestamp. Patients see the freshest listings first, so one tap a day is the highest-value minute of your day.
      </p>

      <div className="grid3" style={{ marginBottom: 24 }}>
        {[["Views this week", "1,284", "+18%", "success"], ["Prescription replies", "37", "+6", "success"], ["Unconfirmed over 24 h", "12", "Needs attention", "warning"]].map(([k, v, d, tone]) => (
          <div key={k} className="card" style={{ padding: 26 }}>
            <p className="t-label dim" style={{ marginBottom: 12 }}>{k}</p>
            <p className="t-h1 mono" style={{ marginBottom: 12 }}>{v}</p>
            <Badge tone={tone}>{d}</Badge>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 26, marginBottom: 24 }}>
        <div className="row" style={{ gap: 10, marginBottom: 8 }}>
          <TrendingUp size={22} color="var(--brand-600)" />
          <h3 className="t-h3">Searched near you, not found</h3>
        </div>
        <p className="t-sm dim" style={{ marginBottom: 18 }}>
          What patients in Uyo looked for in the last 7 days and nobody stocked.
        </p>
        {[["Insulin Glargine 100 IU/ml", 14], ["Ciprofloxacin 500 mg", 9], ["Zinc + ORS sachets", 6]].map(([n, c], i) => (
          <div key={n} className="row" style={{ justifyContent: "space-between", gap: 12, padding: "14px 0", borderTop: i ? "1px solid var(--line)" : 0, flexWrap: "wrap" }}>
            <span className="t-sm" style={{ flex: "1 1 200px" }}>{n}</span>
            <span className="row" style={{ gap: 14 }}>
              <span className="t-xs dim mono">{c} searches</span>
              <Btn size="sm" variant="secondary" icon={Plus} onClick={() => toast(`${n} added to your list`)}>Add</Btn>
            </span>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="row" style={{ padding: 24, justifyContent: "space-between", borderBottom: "1px solid var(--line)", gap: 12, flexWrap: "wrap" }}>
          <h3 className="t-h3">Stock list</h3>
          <Btn variant="ghost" size="sm" icon={Plus} onClick={() => toast("Search the master drug list")}>Add medicine</Btn>
        </div>
        {inv.map((r, i) => (
          <div key={r.n} className="row" style={{ padding: "18px 24px", gap: 16, borderTop: i ? "1px solid var(--line)" : 0, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <strong className="t-body" style={{ display: "block", marginBottom: 8 }}>{r.n}</strong>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {r.inStock ? <StockPulse stockUpdatedAt={r.at} /> : <StockPulse outOfStock />}
                {r.brand && <Badge tone="neutral">{r.brand}</Badge>}
                {r.qty !== null && <span className="t-xs dim mono">{r.qty} left</span>}
              </div>
            </div>
            <button onClick={() => toast(`${r.n} updated`)} role="switch" aria-checked={r.inStock}
              aria-label={`${r.n} in stock`} style={{
                width: 62, height: 36, borderRadius: 999, border: 0, cursor: "pointer", flex: "none",
                background: r.inStock ? "var(--brand-600)" : "var(--surface-3)",
                position: "relative", transition: "background 180ms var(--ease)",
              }}>
              <span style={{
                position: "absolute", top: 4, left: r.inStock ? 30 : 4, width: 28, height: 28,
                borderRadius: 999, background: "#fff", boxShadow: "var(--sh-1)",
                transition: "left 200ms var(--ease)",
              }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerGate({ status }) {
  const pending = status === "PENDING";
  return (
    <div className="app" style={{ paddingTop: 48 }}>
      <div className="card" style={{ padding: 34, textAlign: "center" }}>
        <span style={{
          display: "inline-flex", padding: 18, borderRadius: 20, marginBottom: 20,
          background: pending ? "var(--amber-50)" : "var(--red-50)",
          color: pending ? "var(--amber-700)" : "var(--red-600)",
        }}>{pending ? <Hourglass size={30} /> : <Ban size={30} />}</span>
        <h2 className="t-h2" style={{ marginBottom: 12 }}>
          {pending ? "Your PCN licence is under review" : "Registration not approved"}
        </h2>
        <p className="t-sm dim" style={{ marginBottom: 26 }}>
          {pending
            ? "An admin is checking your licence number against the PCN register. You'll be able to list stock as soon as it clears — usually within two working days."
            : "The licence number supplied didn't match an active PCN record. Send a photo of your current premises licence and we'll re-check it."}
        </p>
        <Btn block variant={pending ? "ghost" : "primary"}>
          {pending ? "Check status" : "Send licence photo"}
        </Btn>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- ADMIN -- */

function Admin({ toast }) {
  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      <h1 className="t-h1" style={{ marginBottom: 26 }}>Admin</h1>

      <div className="grid3" style={{ marginBottom: 28 }}>
        {[["Awaiting review", "4", "Needs attention", "warning"],
          ["Approved pharmacies", "118", "Healthy", "success"],
          ["Zero-result searches (7d)", "312", "Coverage gap", "info"]].map(([k, v, d, tone]) => (
          <div key={k} className="card" style={{ padding: 26 }}>
            <p className="t-label dim" style={{ marginBottom: 12 }}>{k}</p>
            <p className="t-h1 mono" style={{ marginBottom: 12 }}>{v}</p>
            <Badge tone={tone}>{d}</Badge>
          </div>
        ))}
      </div>

      <h2 className="t-h2" style={{ marginBottom: 18 }}>Pending approval</h2>
      {[["Goodness Pharmacy", "PCN/AKS/2204", "Akwa Ibom · Ikot Ekpene"],
        ["Ikeja Meds", "PCN/LAG/0881", "Lagos · Ikeja"]].map((p) => (
        <div key={p[0]} className="card" style={{ padding: 22, marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <strong className="t-body" style={{ display: "block" }}>{p[0]}</strong>
              <span className="t-sm dim mono">{p[1]}</span>
            </div>
            <Badge tone="neutral">{p[2]}</Badge>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <Btn size="sm" onClick={() => toast(`${p[0]} approved`)} style={{ flex: 1 }}>Approve</Btn>
            <Btn size="sm" variant="destructive" onClick={() => toast(`${p[0]} rejected`)} style={{ flex: 1 }}>Reject</Btn>
          </div>
        </div>
      ))}

      <h2 className="t-h2" style={{ margin: "32px 0 18px" }}>Coverage gaps</h2>
      <div className="card" style={{ padding: 24 }}>
        <p className="t-sm dim" style={{ marginBottom: 18 }}>
          Most-searched drugs no pharmacy stocks, by state. Use this to decide who to recruit next.
        </p>
        {[["Insulin Glargine 100 IU/ml", "Akwa Ibom", 46], ["Methotrexate 2.5 mg", "Lagos", 31], ["Salbutamol nebules", "Rivers", 22]].map(([n, st, c], i) => (
          <div key={n} className="row" style={{ justifyContent: "space-between", gap: 12, padding: "14px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
            <span className="t-sm" style={{ flex: 1 }}>{n}</span>
            <Badge tone="neutral">{st}</Badge>
            <span className="t-sm mono dim" style={{ width: 34, textAlign: "right" }}>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- STATES ---- */

function States({ toast }) {
  return (
    <div className="app" style={{ paddingTop: 26 }}>
      <h1 className="t-h1" style={{ marginBottom: 8 }}>States</h1>
      <p className="t-sm dim" style={{ marginBottom: 26 }}>
        Each one names what happened and offers the next move.
      </p>
      <StateBlock icon={<AlertTriangle size={30} />} tone="red"
        title="Search didn't go through"
        body="The connection dropped before results came back. Your search is saved — try again."
        primary="Try again" secondary="Back to search" toast={toast} />
      <StateBlock icon={<WifiOff size={30} />} tone="amber"
        title="You're offline"
        body="Showing your last results from 12 minutes ago. Stock may have changed since then."
        primary="Retry connection" secondary="View saved list" toast={toast} />
      <StateBlock icon={<MapPin size={30} />} tone="brand"
        title="Location is off"
        body="Distances are measured from Uyo centre. Turn on location for exact distances and routes."
        primary="Turn on location" secondary="Keep using Uyo centre" toast={toast} />
      <StateBlock icon={<Info size={30} />} tone="slate"
        title="This page doesn't exist"
        body="The link may be old or mistyped. Search for a medicine instead."
        primary="Go to search" secondary="Open home" toast={toast} />
    </div>
  );
}

const StateBlock = ({ icon, tone, title, body, primary, secondary, toast }) => {
  const bg = { slate: "var(--surface-2)", brand: "var(--brand-50)", red: "var(--red-50)", amber: "var(--amber-50)" }[tone];
  const fg = { slate: "var(--ink-3)", brand: "var(--brand-600)", red: "var(--red-600)", amber: "var(--amber-700)" }[tone];
  return (
    <div className="card" style={{ padding: 32, textAlign: "center", marginBottom: 16 }}>
      <span style={{ display: "inline-flex", padding: 18, borderRadius: 20, marginBottom: 20, background: bg, color: fg }}>{icon}</span>
      <h3 className="t-h3" style={{ marginBottom: 10 }}>{title}</h3>
      <p className="t-sm dim" style={{ marginBottom: 24 }}>{body}</p>
      <Btn block onClick={() => toast(primary)}>{primary}</Btn>
      <Btn variant="quiet" block style={{ marginTop: 8 }} onClick={() => toast(secondary)}>{secondary}</Btn>
    </div>
  );
};

/* ------------------------------------------------------- DESIGN SYSTEM ---- */

function DesignSystem() {
  return (
    <div className="wrap" style={{ padding: "32px 24px 90px" }}>
      <h1 className="t-h1" style={{ marginBottom: 10 }}>Design system</h1>
      <p className="t-body dim" style={{ marginBottom: 40, maxWidth: 640 }}>
        Emerald tokens matching <span className="mono t-sm">globals.css</span>. Everything in the screens is built from these.
      </p>

      <DSGroup title="Color">
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          {[["Brand 600", "#059669"], ["Brand 500", "#10B981"], ["Brand 50", "#ECFDF5"], ["Info", "#2563EB"], ["Warning", "#F59E0B"], ["Danger", "#EF4444"], ["Ink", "#0F172A"], ["Background", "#F8FAF9"]].map(([n, h]) => (
            <div key={n} className="panel" style={{ padding: 12, width: 150 }}>
              <div style={{ height: 52, borderRadius: 12, background: h, border: "1px solid var(--line)", marginBottom: 10 }} />
              <strong className="t-xs" style={{ display: "block" }}>{n}</strong>
              <span className="t-xs dim mono">{h}</span>
            </div>
          ))}
        </div>
      </DSGroup>

      <DSGroup title="Type scale">
        {[["Hero", "t-hero", "56"], ["H1", "t-h1", "42"], ["H2", "t-h2", "32"], ["H3", "t-h3", "24"], ["Body", "t-body", "18"], ["Small", "t-sm", "16"]].map(([n, c, s]) => (
          <div key={n} className="row" style={{ gap: 20, padding: "12px 0", borderTop: "1px solid var(--line)", alignItems: "baseline" }}>
            <span className="t-label dim" style={{ width: 74, flex: "none" }}>{n} {s}</span>
            <span className={c} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Find medicine in stock</span>
          </div>
        ))}
      </DSGroup>

      <DSGroup title="Stock Pulse — the signature">
        <p className="t-sm dim" style={{ marginBottom: 18, maxWidth: 640 }}>
          Reads <span className="mono t-xs">PharmacyResult.stockUpdatedAt</span> through <span className="mono t-xs">relativeTime()</span> —
          both already exist. Under 1 h is fresh, under 24 h is aging, past that it stops claiming to be in stock and says when it was last confirmed.
          The ring animates only on live states.
        </p>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <StockPulse stockUpdatedAt={ago(14)} />
          <StockPulse stockUpdatedAt={ago(190)} />
          <StockPulse stockUpdatedAt={ago(2900)} />
          <StockPulse outOfStock />
        </div>
      </DSGroup>

      <DSGroup title="Buttons">
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Btn icon={Route}>Directions</Btn>
          <Btn variant="secondary" icon={Check}>Confirm stock</Btn>
          <Btn variant="ghost" icon={Phone}>Call</Btn>
          <Btn variant="quiet">Cancel</Btn>
          <Btn variant="destructive" size="sm">Reject</Btn>
          <Btn disabled>Unavailable</Btn>
        </div>
      </DSGroup>

      <DSGroup title="Inputs, chips, badges">
        <div className="field" style={{ maxWidth: 460, marginBottom: 16 }}>
          <Search size={22} color="var(--ink-4)" /><input placeholder="Search a medicine…" />
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <button className="chip" data-on="true">Freshest stock</button>
          <button className="chip">Nearest</button>
          <button className="chip">Open 24 h</button>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Verified />
          <Badge tone="success" icon={Clock}>Open till 22:00</Badge>
          <Badge tone="warning" icon={Hourglass}>Awaiting approval</Badge>
          <Badge tone="danger" icon={Ban}>Rejected</Badge>
          <Badge tone="info">Antimalarial</Badge>
          <Badge tone="brand">1 new</Badge>
        </div>
      </DSGroup>

      <DSGroup title="Ratings — four axes">
        <div className="panel" style={{ padding: 20, maxWidth: 460 }}>
          <div style={{ marginBottom: 16 }}><Stars value={4.6} count={38} /></div>
          {RATING_AXES.map((a) => (
            <div key={a.key} className="row" style={{ gap: 12, marginBottom: 11 }}>
              <span className="t-sm dim2" style={{ width: 120, flex: "none" }}>{a.label}</span>
              <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(a.v / 5) * 100}%`, background: "var(--brand-500)", borderRadius: 999 }} />
              </span>
              <span className="t-xs mono dim" style={{ width: 26, textAlign: "right" }}>{a.v}</span>
            </div>
          ))}
        </div>
      </DSGroup>

      <DSGroup title="Alerts & skeletons">
        <div className="panel" style={{ padding: 18, background: "var(--info-50)", borderColor: "transparent", display: "flex", gap: 12, marginBottom: 16, maxWidth: 580 }}>
          <Info size={20} color="var(--info-600)" style={{ flex: "none", marginTop: 2 }} />
          <span className="t-sm" style={{ color: "var(--info-600)" }}>Pharmacies keep their own stock and hours up to date.</span>
        </div>
        <div className="panel" style={{ padding: 18, maxWidth: 580, display: "grid", gap: 10 }}>
          <Skel w="60%" h={18} /><Skel w="90%" h={14} /><Skel w="40%" h={14} />
        </div>
      </DSGroup>

      <DSGroup title="Spacing & radius">
        <div className="row" style={{ gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          {[4, 8, 12, 16, 24, 32, 48, 64].map((s) => (
            <div key={s} style={{ textAlign: "center" }}>
              <div style={{ width: s, height: s, background: "var(--brand-600)", borderRadius: 3, marginBottom: 8 }} />
              <span className="t-xs dim mono">{s}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 14, marginTop: 24, flexWrap: "wrap" }}>
          {[12, 16, 20, 24, 28].map((r) => (
            <div key={r} style={{ width: 72, height: 72, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: r, display: "grid", placeItems: "center" }}>
              <span className="t-xs dim mono">{r}</span>
            </div>
          ))}
        </div>
      </DSGroup>
    </div>
  );
}

const DSGroup = ({ title, children }) => (
  <section style={{ marginBottom: 48 }}>
    <h2 className="t-h3" style={{ marginBottom: 18 }}>{title}</h2>
    {children}
  </section>
);

/* ---------------------------------------------------------------- ROOT ---- */

export default function MediQuest() {
  const [screen, setScreen] = useState("landing");
  const [theme, setTheme] = useState("light");
  const [toastMsg, setToastMsg] = useState(null);
  const [state, setState] = useState("Akwa Ibom");
  const [lga, setLga] = useState("Uyo");
  const toast = (m) => setToastMsg(m);

  const NAV = [
    ["landing", "Landing"], ["search", "Search"], ["results", "Results"],
    ["medicine", "Medicine"], ["pharmacy", "Pharmacy"], ["empty", "Zero result"],
    ["prescriptions", "Prescriptions"], ["thread", "Thread"], ["queue", "Pharmacist"],
    ["owner", "Owner"], ["gate", "Pending gate"], ["admin", "Admin"],
    ["states", "States"], ["ds", "Design system"],
  ];

  const SCOPED = ["search", "results", "medicine", "pharmacy", "empty"];
  const TABBED = [...SCOPED, "prescriptions", "states"];
  const tabFor = (s) => (["prescriptions"].includes(s) ? "prescriptions" : "search");

  return (
    <div className="mq" data-theme={theme} style={{ display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>

      <div style={{ background: "#0A1512", padding: "10px 16px", position: "sticky", top: 0, zIndex: 60 }}>
        <div className="row" style={{ gap: 8, maxWidth: 1140, margin: "0 auto" }}>
          <div className="scroll-x" style={{ flex: 1 }}>
            {NAV.map(([k, l]) => (
              <button key={k} onClick={() => setScreen(k)} style={{
                flex: "none", padding: "8px 14px", borderRadius: 999, border: 0, cursor: "pointer",
                fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                background: screen === k ? "#059669" : "rgba(255,255,255,.09)",
                color: screen === k ? "#fff" : "#93A5A0",
              }}>{l}</button>
            ))}
          </div>
          <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle dark mode" style={{
            flex: "none", width: 36, height: 36, borderRadius: 999, border: 0, cursor: "pointer",
            background: "rgba(255,255,255,.09)", color: "#fff", display: "grid", placeItems: "center",
          }}>{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
        </div>
      </div>

      {SCOPED.includes(screen) && (
        <ScopeBar state={state} lga={lga} setState={setState} setLga={setLga} precise={false} />
      )}

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }} key={screen}>
        <div className="fade" style={{ flex: 1 }}>
          {screen === "landing" && <Landing go={setScreen} />}
          {screen === "search" && <SearchScreen go={setScreen} toast={toast} />}
          {screen === "results" && <Results go={setScreen} toast={toast} lga={lga} />}
          {screen === "medicine" && <MedicineDetail go={setScreen} toast={toast} />}
          {screen === "pharmacy" && <PharmacyDetail go={setScreen} toast={toast} />}
          {screen === "empty" && <EmptyResult go={setScreen} toast={toast} state={state} lga={lga} />}
          {screen === "prescriptions" && <Prescriptions go={setScreen} toast={toast} />}
          {screen === "thread" && <Thread go={setScreen} toast={toast} />}
          {screen === "queue" && <PharmacistQueue toast={toast} />}
          {screen === "owner" && <OwnerDash toast={toast} />}
          {screen === "gate" && <OwnerGate status="PENDING" />}
          {screen === "admin" && <Admin toast={toast} />}
          {screen === "states" && <States toast={toast} />}
          {screen === "ds" && <DesignSystem />}
        </div>
      </main>

      {TABBED.includes(screen) && (
        <TabBar tab={tabFor(screen)} go={(k) => setScreen(k === "prescriptions" ? "prescriptions" : "search")} />
      )}

      {toastMsg && <Toast msg={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
}
