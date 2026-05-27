import React from "react";

export const metadata = {
  title: "Aether-OS — Zero-Knowledge Virtual Cloud Aggregator",
};

export default function HomePage() {
  const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#060809;
  --bg1:#0c1014;
  --bg2:#111820;
  --bgcard:#0d1318;
  --accent:#00ff9d;
  --accentdim:rgba(0,255,157,0.12);
  --accentglow:rgba(0,255,157,0.25);
  --accent2:#00b8d4;
  --warn:#ffd60a;
  --danger:#ff4757;
  --text:#7a8fa8;
  --textbright:#c8d8e8;
  --textdim:#2e3f52;
  --border:#172030;
  --borderacc:rgba(0,255,157,0.2);
  --font:'JetBrains Mono',monospace;
  --fontd:'Orbitron',monospace;
}
html{scroll-behavior:smooth}
body{
  background:var(--bg);
  color:var(--text);
  font-family:var(--font);
  font-size:14px;
  line-height:1.7;
  overflow-x:hidden;
}
/* scanline overlay */
body::after{
  content:'';
  position:fixed;
  inset:0;
  background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.04) 3px,rgba(0,0,0,0.04) 4px);
  pointer-events:none;
  z-index:9998;
}
/* dot grid bg */
.dot-grid{
  position:fixed;
  inset:0;
  background-image:radial-gradient(circle,rgba(0,255,157,0.07) 1px,transparent 1px);
  background-size:28px 28px;
  pointer-events:none;
  z-index:0;
}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.blink{animation:blink 1.1s step-end infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.accent{color:var(--accent)}
.accent2{color:var(--accent2)}
.dim{color:var(--textdim)}
.bright{color:var(--textbright)}
.warn{color:var(--warn)}
.danger{color:var(--danger)}
.tag{
  display:inline-block;
  padding:2px 8px;
  border:1px solid var(--borderacc);
  color:var(--accent);
  font-size:11px;
  letter-spacing:.08em;
}
.btn{
  display:inline-block;
  padding:10px 22px;
  border:1px solid var(--accent);
  color:var(--accent);
  font-family:var(--font);
  font-size:13px;
  letter-spacing:.06em;
  cursor:pointer;
  background:transparent;
  transition:background .15s,color .15s,box-shadow .15s;
}
.btn:hover{background:var(--accentdim);box-shadow:0 0 18px var(--accentglow);text-decoration:none}
.btn-ghost{border-color:var(--border);color:var(--text)}
.btn-ghost:hover{border-color:var(--borderacc);color:var(--accent)}
.section{position:relative;z-index:1;padding:90px 0}
.container{max-width:1100px;margin:0 auto;padding:0 32px}
.sec-label{
  font-size:11px;
  letter-spacing:.18em;
  color:var(--textdim);
  margin-bottom:8px;
}
.sec-label::before{content:'// '}
h2{font-family:var(--fontd);font-size:28px;color:var(--textbright);letter-spacing:.04em;margin-bottom:16px}
.divider{border:none;border-top:1px solid var(--border);margin:0}
.fade-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease}
.fade-up.visible{opacity:1;transform:none}

/* NAV */
nav{
  position:fixed;top:0;left:0;right:0;z-index:100;
  background:rgba(6,8,9,0.92);
  border-bottom:1px solid var(--border);
  backdrop-filter:blur(12px);
}
.nav-inner{
  max-width:1100px;margin:0 auto;padding:0 32px;
  height:56px;display:flex;align-items:center;justify-content:space-between;
}
.nav-brand{display:flex;align-items:center;gap:10px;color:var(--textbright);font-size:14px;letter-spacing:.04em}
.nav-brand-dot{
  width:8px;height:8px;border-radius:50%;
  background:var(--accent);
  box-shadow:0 0 8px var(--accentglow);
  animation:pulse 2s ease-in-out infinite;
}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 8px var(--accentglow)}50%{opacity:.5;box-shadow:0 0 2px var(--accentglow)}}
.nav-links{display:flex;align-items:center;gap:28px}
.nav-links a{font-size:12px;letter-spacing:.08em;color:var(--text);transition:color .15s}
.nav-links a:hover{color:var(--accent);text-decoration:none}
.nav-cta{margin-left:16px}

/* HERO */
#hero{
  min-height:100vh;
  display:flex;align-items:center;
  padding:100px 0 80px;
  position:relative;z-index:1;
}
.terminal-box{
  border:1px solid var(--border);
  background:var(--bg1);
  max-width:760px;
  position:relative;
}
.terminal-bar{
  background:var(--bg2);
  border-bottom:1px solid var(--border);
  padding:10px 16px;
  display:flex;align-items:center;gap:8px;
}
.terminal-bar-dots{display:flex;gap:6px}
.dot{width:10px;height:10px;border-radius:50%}
.dot-r{background:#ff5f57}
.dot-y{background:#ffbd2e}
.dot-g{background:#28c840}
.terminal-bar-title{
  margin-left:auto;margin-right:auto;
  font-size:11px;color:var(--textdim);letter-spacing:.08em;
}
.terminal-body{padding:24px 28px;min-height:320px}
.t-line{color:var(--text);font-size:14px;line-height:2;white-space:pre}
.t-prompt::before{content:'> ';color:var(--accent)}
.t-ok{color:var(--accent)}
.t-dim{color:var(--textdim)}
.hero-headline{
  margin-top:48px;
}
.hero-headline h1{
  font-family:var(--fontd);
  font-size:clamp(28px,4vw,48px);
  color:var(--textbright);
  letter-spacing:.06em;
  line-height:1.2;
}
.hero-headline h1 span{color:var(--accent)}
.hero-sub{
  margin-top:16px;
  font-size:14px;
  color:var(--text);
  max-width:580px;
  line-height:1.8;
}
.hero-actions{margin-top:32px;display:flex;gap:12px;flex-wrap:wrap}
.hero-stats{
  display:flex;gap:40px;margin-top:48px;
  border-top:1px solid var(--border);
  padding-top:32px;
}
.stat-item .stat-val{
  font-size:20px;color:var(--accent);
  font-family:var(--fontd);letter-spacing:.04em;
}
.stat-item .stat-lbl{font-size:11px;color:var(--textdim);letter-spacing:.1em;margin-top:2px}

/* HOW IT WORKS */
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1px;background:var(--border);margin-top:60px}
.step{
  background:var(--bg1);
  padding:36px 32px;
  position:relative;
  transition:background .2s;
}
.step:hover{background:var(--bg2)}
.step-num{
  font-family:var(--fontd);font-size:11px;
  color:var(--accentdim);
  border:1px solid var(--borderacc);
  padding:4px 10px;
  display:inline-block;
  margin-bottom:20px;
  color:var(--accent);
}
.step h3{font-size:16px;color:var(--textbright);margin-bottom:10px;letter-spacing:.04em}
.step p{font-size:13px;line-height:1.8}
.step-arrow{
  position:absolute;right:-13px;top:50%;transform:translateY(-50%);
  color:var(--accent);font-size:18px;z-index:2;
  display:none;
}
@media(min-width:900px){
  .steps{grid-template-columns:repeat(3,1fr)}
  .step-arrow{display:block}
  .step:last-child .step-arrow{display:none}
}

/* FEATURES */
.features-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(300px,1fr));
  gap:1px;
  background:var(--border);
  margin-top:60px;
}
.feat-card{
  background:var(--bgcard);
  padding:32px 28px;
  transition:background .2s;
  position:relative;
  overflow:hidden;
}
.feat-card::before{
  content:'';
  position:absolute;top:0;left:0;right:0;height:1px;
  background:transparent;
  transition:background .3s;
}
.feat-card:hover{background:var(--bg2)}
.feat-card:hover::before{background:var(--accent)}
.feat-icon{
  font-size:22px;
  color:var(--accent2);
  margin-bottom:16px;
  font-family:var(--font);
}
.feat-card h3{font-size:14px;color:var(--textbright);margin-bottom:8px;letter-spacing:.04em}
.feat-card p{font-size:13px;line-height:1.8}
.feat-tag{
  margin-top:14px;
  font-size:10px;
  color:var(--accent);
  letter-spacing:.12em;
  border-left:2px solid var(--accent);
  padding-left:8px;
}

/* PRICING */
.pricing-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
  gap:16px;
  margin-top:60px;
}
.price-card{
  border:1px solid var(--border);
  background:var(--bgcard);
  padding:32px 28px;
  transition:border-color .2s,box-shadow .2s;
  position:relative;
}
.price-card.featured{
  border-color:var(--accent);
  box-shadow:0 0 32px rgba(0,255,157,0.07);
}
.price-badge{
  position:absolute;top:-1px;left:50%;transform:translateX(-50%);
  background:var(--accent);color:var(--bg);
  font-size:10px;letter-spacing:.1em;padding:3px 12px;
}
.price-tier{font-size:10px;letter-spacing:.16em;color:var(--accent);margin-bottom:8px}
.price-name{font-family:var(--fontd);font-size:18px;color:var(--textbright);margin-bottom:20px}
.price-amount{font-size:32px;color:var(--textbright);margin-bottom:4px;font-family:var(--fontd)}
.price-amount sup{font-size:14px;vertical-align:super}
.price-period{font-size:12px;color:var(--textdim);margin-bottom:24px}
.price-divider{border:none;border-top:1px solid var(--border);margin-bottom:24px}
.price-features{list-style:none;margin-bottom:28px}
.price-features li{
  font-size:13px;padding:6px 0;
  border-bottom:1px solid rgba(23,32,48,0.5);
  display:flex;align-items:center;gap:8px;
}
.price-features li::before{content:'◆';font-size:8px;color:var(--accent)}
.price-features li.off{color:var(--textdim)}
.price-features li.off::before{color:var(--textdim)}

/* FAQ */
.faq-list{margin-top:60px;border:1px solid var(--border)}
.faq-item{border-bottom:1px solid var(--border)}
.faq-item:last-child{border-bottom:none}
.faq-q{
  width:100%;background:none;border:none;
  padding:20px 24px;
  text-align:left;
  font-family:var(--font);font-size:13px;
  color:var(--textbright);
  cursor:pointer;
  display:flex;justify-content:space-between;align-items:center;
  transition:background .15s;
  letter-spacing:.02em;
}
.faq-q:hover{background:var(--bg2)}
.faq-q::before{content:'> ';color:var(--accent)}
.faq-arrow{color:var(--accent);font-size:16px;transition:transform .2s;flex-shrink:0}
.faq-a{
  max-height:0;overflow:hidden;
  transition:max-height .3s ease;
}
.faq-a-inner{
  padding:0 24px 20px 40px;
  font-size:13px;line-height:1.9;color:var(--text);
}
.faq-item.open .faq-arrow{transform:rotate(180deg)}
.faq-item.open .faq-a{max-height:300px}

/* WAITLIST */
#waitlist{
  background:var(--bg1);
  border-top:1px solid var(--border);
  border-bottom:1px solid var(--border);
}
.wl-inner{max-width:600px;margin:0 auto;text-align:center}
.wl-inner .sec-label{justify-content:center}
.wl-terminal{
  border:1px solid var(--borderacc);
  background:var(--bgcard);
  margin-top:40px;
  padding:32px;
  position:relative;
}
.wl-terminal::before{
  content:'[EARLY ACCESS INTAKE]';
  position:absolute;top:-10px;left:24px;
  background:var(--bgcard);
  padding:0 8px;
  font-size:11px;color:var(--accent);letter-spacing:.12em;
}
.wl-form{display:flex;gap:0;margin-top:8px}
.wl-input{
  flex:1;
  background:var(--bg);
  border:1px solid var(--border);
  border-right:none;
  padding:12px 16px;
  font-family:var(--font);font-size:13px;
  color:var(--textbright);
  outline:none;
  transition:border-color .15s;
}
.wl-input::placeholder{color:var(--textdim)}
.wl-input:focus{border-color:var(--borderacc)}
.wl-btn{
  background:var(--accent);
  border:1px solid var(--accent);
  padding:12px 24px;
  font-family:var(--font);font-size:13px;
  color:var(--bg);letter-spacing:.06em;
  cursor:pointer;
  transition:opacity .15s;
  white-space:nowrap;
}
.wl-btn:hover{opacity:.85}
.wl-note{font-size:11px;color:var(--textdim);margin-top:12px}
.wl-success{
  display:none;
  text-align:left;
}
.wl-success .t-line{color:var(--text);font-size:13px;line-height:2}

/* TEAM */
.team-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
  gap:1px;background:var(--border);
  margin-top:60px;
}
.team-card{
  background:var(--bgcard);
  padding:28px 24px;
  transition:background .2s;
}
.team-card:hover{background:var(--bg2)}
.team-avatar{
  width:48px;height:48px;border-radius:4px;
  background:var(--bg2);
  border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;
  font-size:18px;color:var(--accent);
  margin-bottom:16px;font-family:var(--fontd);
  font-size:14px;letter-spacing:.04em;
}
.team-name{font-size:14px;color:var(--textbright);margin-bottom:4px}
.team-role{font-size:11px;color:var(--accent);letter-spacing:.1em;margin-bottom:8px}
.team-bio{font-size:12px;line-height:1.7}
.team-links{margin-top:12px;display:flex;gap:12px}
.team-links a{font-size:11px;color:var(--textdim);transition:color .15s}
.team-links a:hover{color:var(--accent);text-decoration:none}

/* FOOTER */
footer{
  position:relative;z-index:1;
  border-top:1px solid var(--border);
  padding:40px 0;
}
.footer-inner{
  max-width:1100px;margin:0 auto;padding:0 32px;
  display:flex;justify-content:space-between;align-items:center;
  flex-wrap:wrap;gap:16px;
}
.footer-brand{font-size:13px;color:var(--textdim)}
.footer-links{display:flex;gap:20px}
.footer-links a{font-size:12px;color:var(--textdim);transition:color .15s}
.footer-links a:hover{color:var(--accent);text-decoration:none}
.footer-note{font-size:11px;color:var(--textdim)}

/* scrollbar */
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border)}
::-webkit-scrollbar-thumb:hover{background:var(--textdim)}

/* responsive nav */
@media(max-width:640px){
  .nav-links{display:none}
  .hero-stats{flex-wrap:wrap;gap:24px}
  h2{font-size:22px}
}
`;

  const html = `
<div class="dot-grid"></div>

<!-- NAV -->
<nav>
  <div class="nav-inner">
    <div class="nav-brand">
      <div class="nav-brand-dot"></div>
      <span>◈ AETHER-OS <span style="color:var(--textdim);font-size:11px">v0.1.0-α</span></span>
    </div>
    <div class="nav-links">
      <a href="#how-it-works">How It Works</a>
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a href="#faq">FAQ</a>
      <a href="#team">Team</a>
      <a href="/login" class="btn nav-cta" style="padding:7px 16px;font-size:12px">&gt; OPEN CONSOLE</a>
    </div>
  </div>
</nav>

<!-- HERO -->
<section id="hero">
  <div class="container">
    <div class="terminal-box">
      <div class="terminal-bar">
        <div class="terminal-bar-dots">
          <div class="dot dot-r"></div>
          <div class="dot dot-y"></div>
          <div class="dot dot-g"></div>
        </div>
        <div class="terminal-bar-title">aether-os — boot sequence</div>
      </div>
      <div class="terminal-body">
        <div class="t-line t-dim"># Aether-OS kernel bootstrap v0.1.0-alpha</div>
        <div class="t-line t-dim"># ─────────────────────────────────────────</div>
        <div class="t-line">&nbsp;</div>
        <div id="boot-lines"></div>
        <div id="boot-cursor" class="t-line t-prompt" style="display:none"><span class="blink">█</span></div>
      </div>
    </div>

    <div class="hero-headline fade-up" id="hero-headline" style="display:none">
      <h1>YOUR FILES.<br>YOUR KEYS.<br><span>EVERYWHERE.</span></h1>
      <p class="hero-sub">Zero-knowledge virtual cloud aggregator. Client-side AES-256-GCM encryption, RS(10,4) erasure coding, and multi-provider distribution — all before a single byte leaves your device.</p>
      <div class="hero-actions">
        <a href="#waitlist" class="btn">&gt; JOIN EARLY ACCESS</a>
        <a href="#how-it-works" class="btn btn-ghost">&gt; SEE HOW IT WORKS</a>
      </div>
    </div>

    <div class="hero-stats fade-up" id="hero-stats" style="display:none">
      <div class="stat-item">
        <div class="stat-val">AES-256</div>
        <div class="stat-lbl">ENCRYPTION STANDARD</div>
      </div>
      <div class="stat-item">
        <div class="stat-val">RS(10,4)</div>
        <div class="stat-lbl">ERASURE CODING</div>
      </div>
      <div class="stat-item">
        <div class="stat-val">0-KB</div>
        <div class="stat-lbl">PLAINTEXT ON SERVERS</div>
      </div>
      <div class="stat-item">
        <div class="stat-val">∞</div>
        <div class="stat-lbl">PROVIDERS SUPPORTED</div>
      </div>
    </div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section id="how-it-works" class="section" style="padding-top:40px">
  <div class="container">
    <p class="sec-label fade-up">HOW IT WORKS</p>
    <h2 class="fade-up">Three phases. Zero trust.</h2>
    <p class="fade-up" style="max-width:520px;font-size:13px">Every file goes through a deterministic pipeline before touching the network. No exceptions. No overrides.</p>
    <div class="steps">
      <div class="step fade-up">
        <div class="step-num">[01] ENCRYPT</div>
        <h3>Client-Side Encryption</h3>
        <p>A unique AES-256-GCM key is derived from your master password using Argon2id — on your device, in your browser. The server never sees your key. Never.</p>
        <div class="feat-tag">AES-256-GCM · ARGON2ID</div>
        <div class="step-arrow">→</div>
      </div>
      <div class="step fade-up">
        <div class="step-num">[02] SHARD</div>
        <h3>Erasure Coding</h3>
        <p>Encrypted data is split into 14 shards using Reed-Solomon RS(10,4) coding. Any 10 shards reconstruct the original. Lose 4 entire providers — still intact.</p>
        <div class="feat-tag">RS(10,4) · 14 SHARDS</div>
        <div class="step-arrow">→</div>
      </div>
      <div class="step fade-up">
        <div class="step-num">[03] DISTRIBUTE</div>
        <h3>Multi-Provider Routing</h3>
        <p>Shards are distributed across multiple cloud providers simultaneously via OAuth adapters. No single provider holds enough shards to reconstruct your data.</p>
        <div class="feat-tag">GOOGLE · ONEDRIVE · DROPBOX</div>
        <div class="step-arrow">→</div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURES -->
<section id="features" class="section">
  <div class="container">
    <p class="sec-label fade-up">FEATURES</p>
    <h2 class="fade-up">Built for paranoia.<br>Designed for humans.</h2>
    <div class="features-grid">
      <div class="feat-card fade-up">
        <div class="feat-icon">[ ZK ]</div>
        <h3>Zero-Knowledge Architecture</h3>
        <p>Our servers process only ciphertext. We cannot read your files, respond to subpoenas, or be compelled to hand over plaintext — because we don't have it.</p>
        <div class="feat-tag">ZERO TRUST · PRIVACY BY DESIGN</div>
      </div>
      <div class="feat-card fade-up">
        <div class="feat-icon">[ EC ]</div>
        <h3>RS(10,4) Erasure Coding</h3>
        <p>Reed-Solomon parity sharding provides 4-provider fault tolerance. Your data survives outages, acquisitions, account bans, or regional failures — automatically.</p>
        <div class="feat-tag">40% REDUNDANCY · NO REPLICATION</div>
      </div>
      <div class="feat-card fade-up">
        <div class="feat-icon">[ MP ]</div>
        <h3>Multi-Provider Distribution</h3>
        <p>Connect Google Drive, OneDrive, Dropbox, and S3-compatible stores simultaneously. Aether routes shards intelligently based on latency and availability.</p>
        <div class="feat-tag">OAUTH 2.0 · ADAPTIVE ROUTING</div>
      </div>
      <div class="feat-card fade-up">
        <div class="feat-icon">[ CR ]</div>
        <h3>CRDT Conflict Resolution</h3>
        <p>Conflict-free replicated data types enable seamless sync across devices without a central coordinator. Merge conflicts are mathematically impossible.</p>
        <div class="feat-tag">OPERATION-BASED CRDT</div>
      </div>
      <div class="feat-card fade-up">
        <div class="feat-icon">[ KD ]</div>
        <h3>Hardware-Grade Key Derivation</h3>
        <p>Argon2id key derivation with memory-hard parameters. Brute-force and GPU attacks become computationally prohibitive even against state-level adversaries.</p>
        <div class="feat-tag">ARGON2ID · MEMORY-HARD KDF</div>
      </div>
      <div class="feat-card fade-up">
        <div class="feat-icon">[ PA ]</div>
        <h3>Provider Agnostic</h3>
        <p>No lock-in. Revoke a provider's access at any time and your data remains intact across the remaining shards. Migrate freely, forever.</p>
        <div class="feat-tag">OPEN STANDARD · SELF-HOSTABLE</div>
      </div>
    </div>
  </div>
</section>

<!-- PRICING -->
<section id="pricing" class="section" style="background:var(--bg1)">
  <div class="container">
    <p class="sec-label fade-up">PRICING</p>
    <h2 class="fade-up">Early access. Honest pricing.</h2>
    <p class="fade-up" style="font-size:13px;max-width:480px">All plans include zero-knowledge encryption. We will never monetize your metadata, access patterns, or file contents.</p>
    <div class="pricing-grid">
      <!-- Free -->
      <div class="price-card fade-up">
        <div class="price-tier">TIER_00</div>
        <div class="price-name">NULL_SECTOR</div>
        <div class="price-amount">FREE</div>
        <div class="price-period">forever · no credit card</div>
        <hr class="price-divider">
        <ul class="price-features">
          <li>5 GB encrypted storage</li>
          <li>Up to 2 cloud providers</li>
          <li>AES-256-GCM encryption</li>
          <li>Basic CRDT sync</li>
          <li class="off">RS erasure coding</li>
          <li class="off">Priority routing</li>
          <li class="off">SLA guarantee</li>
        </ul>
        <a href="#waitlist" class="btn btn-ghost" style="width:100%;text-align:center">&gt; GET STARTED</a>
      </div>
      <!-- Pro -->
      <div class="price-card featured fade-up">
        <div class="price-badge">MOST POPULAR</div>
        <div class="price-tier">TIER_01</div>
        <div class="price-name">ALPHA_CHANNEL</div>
        <div class="price-amount"><sup>$</sup>9</div>
        <div class="price-period">per month · billed annually</div>
        <hr class="price-divider">
        <ul class="price-features">
          <li>500 GB encrypted storage</li>
          <li>Up to 5 cloud providers</li>
          <li>AES-256-GCM encryption</li>
          <li>Full CRDT sync</li>
          <li>RS(10,4) erasure coding</li>
          <li>Adaptive priority routing</li>
          <li class="off">SLA guarantee</li>
        </ul>
        <a href="#waitlist" class="btn" style="width:100%;text-align:center">&gt; JOIN WAITLIST</a>
      </div>
      <!-- Enterprise -->
      <div class="price-card fade-up">
        <div class="price-tier">TIER_02</div>
        <div class="price-name">ROOT_ACCESS</div>
        <div class="price-amount" style="font-size:22px;padding-top:6px">CUSTOM</div>
        <div class="price-period">contact for pricing</div>
        <hr class="price-divider">
        <ul class="price-features">
          <li>Unlimited storage</li>
          <li>Unlimited providers</li>
          <li>AES-256-GCM + HSM key</li>
          <li>Full CRDT sync</li>
          <li>RS(10,4) erasure coding</li>
          <li>Dedicated routing cluster</li>
          <li>99.99% SLA guarantee</li>
        </ul>
        <a href="mailto:hello@aether-os.dev" class="btn btn-ghost" style="width:100%;text-align:center">&gt; CONTACT US</a>
      </div>
    </div>
  </div>
</section>

<!-- FAQ -->
<section id="faq" class="section">
  <div class="container">
    <p class="sec-label fade-up">FAQ</p>
    <h2 class="fade-up">Common queries.</h2>
    <div class="faq-list fade-up">
      <div class="faq-item">
        <button class="faq-q">What does "zero-knowledge" actually mean?<span class="faq-arrow">▼</span></button>
        <div class="faq-a"><div class="faq-a-inner">Zero-knowledge means your encryption key is derived and lives exclusively on your device. Aether-OS servers receive and store only ciphertext — encrypted blobs that are mathematically unreadable without your key. Even if our infrastructure were compromised or we received a government subpoena, we have nothing to hand over. This is architecturally enforced, not a policy promise.</div></div>
      </div>
      <div class="faq-item">
        <button class="faq-q">How does erasure coding differ from replication?<span class="faq-arrow">▼</span></button>
        <div class="faq-a"><div class="faq-a-inner">Traditional replication stores 3 full copies of your data (300% storage overhead). RS(10,4) erasure coding splits data into 10 data shards + 4 parity shards, requiring only 40% overhead for the same fault tolerance. You can lose any 4 shards — entire providers going offline — and still reconstruct perfectly from the remaining 10.</div></div>
      </div>
      <div class="faq-item">
        <button class="faq-q">Which cloud providers are supported?<span class="faq-arrow">▼</span></button>
        <div class="faq-a"><div class="faq-a-inner">At launch: Google Drive, Microsoft OneDrive, Dropbox, and any S3-compatible storage (AWS S3, Backblaze B2, Cloudflare R2). We're adding Box, pCloud, and Mega in Q2. The architecture is provider-agnostic — if it exposes an OAuth or S3-compatible API, we can adapter it in.</div></div>
      </div>
      <div class="faq-item">
        <button class="faq-q">What happens if I forget my master password?<span class="faq-arrow">▼</span></button>
        <div class="faq-a"><div class="faq-a-inner">Your master password is never transmitted to our servers — so we cannot reset it. This is by design. Aether-OS generates a 24-word BIP39 recovery phrase during account setup. Store this phrase securely offline. If you lose both your password and recovery phrase, your data is cryptographically unrecoverable — even by us.</div></div>
      </div>
      <div class="faq-item">
        <button class="faq-q">Is Aether-OS open source?<span class="faq-arrow">▼</span></button>
        <div class="faq-a"><div class="faq-a-inner">The client-side encryption library and shard pipeline are open source and available on GitHub for audit. The orchestration backend is currently source-available with plans to open-source under AGPL post-launch. We believe security through obscurity is not security — our threat model must survive public scrutiny.</div></div>
      </div>
    </div>
  </div>
</section>

<!-- WAITLIST -->
<section id="waitlist" class="section">
  <div class="container">
    <div class="wl-inner">
      <p class="sec-label" style="display:block">EARLY ACCESS</p>
      <h2>Request access.<br>Shape the roadmap.</h2>
      <p style="font-size:13px;margin-top:8px">Early access members get lifetime 50% pricing, direct access to the team, and shape feature priorities. Currently accepting <span class="accent">87 slots</span>.</p>
      <div class="wl-terminal">
        <div id="wl-form-wrapper">
          <div class="t-line t-dim" style="margin-bottom:16px;font-size:13px"># Enter email to register interest</div>
          <div class="wl-form">
            <input type="email" id="wl-email" class="wl-input" placeholder="user@domain.tld">
            <button class="wl-btn" onclick="submitWaitlist()">&gt; REQUEST ACCESS</button>
          </div>
          <p class="wl-note">No spam. No marketing. Just a ping when your slot is ready.</p>
        </div>
        <div class="wl-success" id="wl-success">
          <div class="t-line t-dim">&nbsp;</div>
          <div class="t-line"><span class="accent">&gt;</span> Registering access request...</div>
          <div class="t-line" id="wl-s2" style="display:none"><span class="accent">&gt;</span> Validating email signature... <span class="t-ok">[OK]</span></div>
          <div class="t-line" id="wl-s3" style="display:none"><span class="accent">&gt;</span> Adding to priority queue... <span class="t-ok">[OK]</span></div>
          <div class="t-line" id="wl-s4" style="display:none"><span class="accent">&gt;</span> Slot reserved. Confirmation dispatched. <span class="t-ok">[DONE]</span></div>
          <div class="t-line" id="wl-s5" style="display:none">&nbsp;</div>
          <div class="t-line" id="wl-s6" style="display:none;color:var(--textbright)">You're on the list. We'll be in touch soon.<span class="blink"> █</span></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- TEAM -->
<section id="team" class="section" style="background:var(--bg1)">
  <div class="container">
    <p class="sec-label fade-up">TEAM</p>
    <h2 class="fade-up">People behind the protocol.</h2>
    <div class="team-grid">
      <div class="team-card fade-up">
        <div class="team-avatar">SM</div>
        <div class="team-name">Shiv Mahto</div>
        <div class="team-role">FOUNDER · ARCHITECT</div>
        <p class="team-bio">ICT/ELV engineer turned distributed systems architect. Built Aether-OS to solve real data sovereignty problems encountered in large-scale infrastructure projects.</p>
        <div class="team-links">
          <a href="#">github</a>
          <a href="#">linkedin</a>
        </div>
      </div>
      <div class="team-card fade-up" style="opacity:.5">
        <div class="team-avatar" style="color:var(--textdim);border-style:dashed">??</div>
        <div class="team-name" style="color:var(--textdim)">POSITION OPEN</div>
        <div class="team-role">BACKEND ENGINEER</div>
        <p class="team-bio">Looking for a Rust engineer with experience in distributed systems, erasure coding, or storage infrastructure. Remote-first.</p>
        <div class="team-links">
          <a href="mailto:hello@aether-os.dev">apply →</a>
        </div>
      </div>
      <div class="team-card fade-up" style="opacity:.5">
        <div class="team-avatar" style="color:var(--textdim);border-style:dashed">??</div>
        <div class="team-name" style="color:var(--textdim)">POSITION OPEN</div>
        <div class="team-role">SECURITY RESEARCHER</div>
        <p class="team-bio">Cryptography or security background. Help us validate the ZK architecture, threat model, and audit the encryption pipeline end-to-end.</p>
        <div class="team-links">
          <a href="mailto:hello@aether-os.dev">apply →</a>
        </div>
      </div>
      <div class="team-card fade-up" style="opacity:.5">
        <div class="team-avatar" style="color:var(--textdim);border-style:dashed">??</div>
        <div class="team-name" style="color:var(--textdim)">POSITION OPEN</div>
        <div class="team-role">FRONTEND ENGINEER</div>
        <p class="team-bio">TypeScript / Next.js engineer who cares deeply about UX and zero-compromise security UI. Help us build the client that users actually trust.</p>
        <div class="team-links">
          <a href="mailto:hello@aether-os.dev">apply →</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="footer-inner">
    <div>
      <div class="footer-brand">◈ AETHER-OS <span style="font-size:11px">v0.1.0-alpha</span></div>
      <div class="footer-note" style="margin-top:4px">© 2025 Aether-OS. Your keys. Your data.</div>
    </div>
    <div class="footer-links">
      <a href="#">Docs</a>
      <a href="#">GitHub</a>
      <a href="#">Security</a>
      <a href="#">Privacy</a>
      <a href="mailto:hello@aether-os.dev">Contact</a>
    </div>
  </div>
</footer>
  `;

  const script = `
// --- BOOT SEQUENCE ---
const bootLines = [
  {text:'Initializing Aether-OS kernel...      ', status:'OK',   color:'var(--accent)'},
  {text:'Loading zero-knowledge modules...     ', status:'OK',   color:'var(--accent)'},
  {text:'Argon2id KDF pipeline verified...     ', status:'OK',   color:'var(--accent)'},
  {text:'Erasure coding engine online...       ', status:'OK',   color:'var(--accent)'},
  {text:'Multi-provider adapters ready...      ', status:'OK',   color:'var(--accent)'},
  {text:'CRDT sync layer initialized...        ', status:'OK',   color:'var(--accent)'},
  {text:'System ready.                         ', status:null,   color:null},
];

const container = document.getElementById('boot-lines');
const cursor = document.getElementById('boot-cursor');
let lineIdx = 0;

function typeLine(lineObj, cb) {
  const div = document.createElement('div');
  div.className = 't-line';
  if(lineObj.status !== null) {
    div.innerHTML = '<span style="color:var(--accent)">» </span>';
  } else {
    div.innerHTML = '<span style="color:var(--textdim)">  </span>';
  }
  const span = document.createElement('span');
  div.appendChild(span);
  container.appendChild(div);

  let i = 0;
  const full = lineObj.text;
  const t = setInterval(() => {
    span.textContent = full.slice(0, ++i);
    if(i >= full.length) {
      clearInterval(t);
      if(lineObj.status) {
        const badge = document.createElement('span');
        badge.style.color = lineObj.color;
        badge.textContent = '[' + lineObj.status + ']';
        div.appendChild(badge);
      }
      setTimeout(cb, lineObj.status ? 80 : 200);
    }
  }, 18);
}

function runBoot() {
  if(lineIdx >= bootLines.length) {
    if (cursor) cursor.style.display = 'block';
    setTimeout(() => {
      const hl = document.getElementById('hero-headline');
      const hs = document.getElementById('hero-stats');
      if (hl) hl.style.display = 'block';
      if (hs) hs.style.display = 'flex';
      setTimeout(() => { 
        if (hl) hl.classList.add('visible'); 
        if (hs) hs.classList.add('visible'); 
      }, 30);
    }, 600);
    return;
  }
  typeLine(bootLines[lineIdx++], runBoot);
}

setTimeout(runBoot, 400);

// --- SCROLL FADE ---
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }});
}, {threshold:0.12});
document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));

// --- FAQ ---
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if(!wasOpen) item.classList.add('open');
  });
});

// --- WAITLIST ---
window.submitWaitlist = function() {
  const emailInput = document.getElementById('wl-email');
  const email = emailInput ? emailInput.value.trim() : "";
  if(!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    if (emailInput) {
        emailInput.style.borderColor = 'var(--danger)';
        setTimeout(() => emailInput.style.borderColor = '', 1000);
    }
    return;
  }
  document.getElementById('wl-form-wrapper').style.display = 'none';
  const suc = document.getElementById('wl-success');
  suc.style.display = 'block';
  const steps = ['wl-s2','wl-s3','wl-s4','wl-s5','wl-s6'];
  steps.forEach((id, i) => setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  }, (i+1)*600));
}

const wlEmail = document.getElementById('wl-email');
if (wlEmail) {
    wlEmail.addEventListener('keydown', e => {
      if(e.key === 'Enter') window.submitWaitlist();
    });
}
  `;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,700;1,400&family=Orbitron:wght@700;900&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}
