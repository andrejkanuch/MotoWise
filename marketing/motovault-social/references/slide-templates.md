# HTML Slide Templates

These are the proven slide layouts extracted from existing MotoVault carousels. Use them as
the starting point for every new slide — only modify the content, accent colors, and screenshots.

## Shared Base CSS (include in every slide)

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
* { margin:0;padding:0;box-sizing:border-box; }
body { font-family:'Plus Jakarta Sans',sans-serif;width:1080px;height:1080px;overflow:hidden; }
.slide { width:1080px;height:1080px;position:relative;overflow:hidden;background:#0a0a0a; }
.phone-img { border-radius:36px;border:2px solid rgba(255,255,255,0.06); }
.slide-num { position:absolute;top:36px;right:40px;color:rgba(255,255,255,0.12);font-size:14px;font-weight:600;z-index:10;letter-spacing:1px; }
```

## Template 1: Cover Slide (centered, vertical stack)

Use for slide 1. No slide number. Includes brand footer.

```html
<div class="slide s1">
  <div class="bg1"></div><div class="bg2"></div>
  <div class="label">
    <svg><!-- feature icon --></svg> FEATURE NAME
  </div>
  <div class="title">Bold Headline.<br><span>Accent Words.</span></div>
  <div class="subtitle">One-line description of what this feature does</div>
  <img class="phone-img" src="screenshot.png" alt="">
  <div class="brand">
    <img class="logo-icon" src="logo.png" alt="">
    <div class="logo-text">MotoVault</div>
  </div>
  <div class="swipe">Swipe →</div>
</div>
```

```css
.s1 { display:flex;flex-direction:column;align-items:center;justify-content:center; }
.bg1 { position:absolute;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.12) 0%,rgba(59,130,246,0.02) 40%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%); }
.bg2 { position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(212,98,46,0.07) 0%,transparent 60%);top:5%;right:-5%; }
.label { position:relative;z-index:2;color:#3b82f6;font-size:15px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:20px;padding:8px 24px;border:1px solid rgba(59,130,246,0.3);border-radius:100px;background:rgba(59,130,246,0.06);display:flex;align-items:center;gap:10px; }
.title { position:relative;z-index:2;color:#fafafa;font-size:64px;font-weight:800;text-align:center;line-height:1.12;max-width:800px;margin-bottom:20px; }
.title span { background:linear-gradient(135deg,#3b82f6,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.subtitle { position:relative;z-index:2;color:#a3a3a3;font-size:22px;text-align:center;max-width:560px;line-height:1.5;margin-bottom:36px; }
.phone-img { position:relative;z-index:2;width:240px;box-shadow:0 0 80px rgba(59,130,246,0.12),0 20px 80px rgba(0,0,0,0.5); }
.brand { position:absolute;bottom:44px;left:48px;z-index:2;display:flex;align-items:center;gap:12px; }
.logo-icon { width:40px;height:40px;border-radius:10px;object-fit:cover; }
.logo-text { color:#fafafa;font-size:20px;font-weight:700; }
.swipe { position:absolute;bottom:48px;right:48px;z-index:2;color:#525252;font-size:14px;font-weight:500; }
```

## Template 2: Problem Slide (centered, pain-point cards)

Use for slide 2. Always 4 pain points with red X icons.

```html
<div class="slide s2">
  <div class="bg"></div>
  <div class="slide-num">2 / 7</div>
  <div class="icon-wrap"><svg><!-- large topic icon, 56px --></svg></div>
  <div class="question">Three-Line<br>Question<br>Format?</div>
  <div class="pain-points">
    <div class="pp"><span class="x"><svg><!-- X icon --></svg></span>Pain point text</div>
    <!-- repeat 3 more -->
  </div>
</div>
```

```css
.s2 { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px; }
.bg { position:absolute;inset:0;background-image:radial-gradient(circle at 20% 80%,rgba(59,130,246,0.06) 0%,transparent 50%),radial-gradient(circle at 80% 20%,rgba(212,98,46,0.04) 0%,transparent 50%); }
.icon-wrap { position:relative;z-index:2;margin-bottom:36px;color:#60a5fa; }
.question { position:relative;z-index:2;color:#fafafa;font-size:50px;font-weight:800;text-align:center;line-height:1.2;margin-bottom:48px; }
.pain-points { position:relative;z-index:2;display:flex;flex-direction:column;gap:18px;width:100%;max-width:680px; }
.pp { display:flex;align-items:center;gap:20px;padding:22px 30px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:18px;color:#d4d4d4;font-size:21px;font-weight:500; }
.x { width:36px;height:36px;border-radius:50%;background:rgba(239,68,68,0.12);display:flex;align-items:center;justify-content:center;color:#ef4444;flex-shrink:0; }
```

X icon SVG:
```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
```

## Template 3: Feature Step — Text Left, Phone Right

Use for odd-numbered step slides (3, 5). Phone on the right, text on the left.

```html
<div class="slide s3">
  <div class="bg"></div>
  <div class="slide-num">3 / 7</div>
  <div class="text">
    <div class="step-badge">Step 1</div>
    <div class="feature-title">Feature<br>Headline</div>
    <div class="feature-desc">Description paragraph.</div>
    <div class="highlight-box">Callout with <strong>bold accent</strong> text</div>
  </div>
  <div class="phone"><img class="phone-img" src="screenshot.png" alt=""></div>
</div>
```

```css
.s3 { display:flex;align-items:center;padding:60px 56px;gap:44px; }
.bg { position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.07) 0%,transparent 60%);right:-80px;top:50%;transform:translateY(-50%); }
.text { flex:1;z-index:2; }
.step-badge { /* see Template 2 badge pattern, swap color */ }
.feature-title { color:#fafafa;font-size:44px;font-weight:800;line-height:1.12;margin-bottom:18px; }
.feature-desc { color:#a3a3a3;font-size:19px;line-height:1.6;margin-bottom:28px; }
.highlight-box { background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:16px;padding:20px 24px;color:#d4d4d4;font-size:17px;line-height:1.5; }
.highlight-box strong { color:#60a5fa; }
.phone { position:relative;z-index:2; }
.phone .phone-img { width:380px;box-shadow:0 0 80px rgba(59,130,246,0.08),0 30px 100px rgba(0,0,0,0.5); }
```

## Template 4: Feature Step — Phone Left, Text Right

Use for even-numbered step slides (4, 6). Mirror of Template 3.

```html
<div class="slide s4">
  <div class="bg"></div>
  <div class="slide-num">4 / 7</div>
  <div class="phone"><img class="phone-img" src="screenshot.png" alt=""></div>
  <div class="text">
    <div class="step-badge">Step 2</div>
    <div class="feature-title">Feature<br>Headline</div>
    <div class="feature-desc">Description paragraph.</div>
    <!-- optional: list items, tags, or highlight box -->
  </div>
</div>
```

```css
.s4 { display:flex;align-items:center;padding:60px 56px;gap:44px; }
.bg { position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(ACCENT,0.07) 0%,transparent 60%);left:-80px;top:50%;transform:translateY(-50%); }
/* Rest same as Template 3 but with glow on left side */
```

## Template 5: Dual Phone (centered, two screenshots)

Use when showing two related screens side by side (e.g., steps 3 & 4, or expense + alerts).

```html
<div class="slide s5">
  <div class="bg"></div>
  <div class="slide-num">5 / 7</div>
  <div class="step-badge">Steps 3 & 4</div>
  <div class="feature-title">Bold.<br>Title.</div>
  <div class="feature-desc">Short description.</div>
  <div class="phones">
    <img class="phone-img" src="left.png" alt="">
    <span class="arrow">→</span>
    <img class="phone-img" src="right.png" alt="">
  </div>
</div>
```

```css
.s5 { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px; }
.bg { position:absolute;width:800px;height:800px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.08) 0%,transparent 60%);top:50%;left:50%;transform:translate(-50%,-50%); }
/* step-badge, feature-title, feature-desc centered with position:relative;z-index:2 */
.phones { position:relative;z-index:2;display:flex;gap:20px;align-items:center; }
.phones .phone-img { width:260px;box-shadow:0 0 80px rgba(59,130,246,0.1),0 30px 100px rgba(0,0,0,0.5); }
.arrow { color:#60a5fa;font-size:36px;font-weight:800; }
```

## Template 6: CTA Slide (centered, download prompt)

Use for the final slide. Always includes logo, headline, store badges, CTA button.

```html
<div class="slide s7">
  <div class="bg"></div>
  <div class="slide-num">7 / 7</div>
  <img class="logo-big" src="logo.png" alt="">
  <div class="cta-title">Action Verb.<br>Start <span>Accent.</span></div>
  <div class="cta-sub">Value prop. Free details.</div>
  <div class="stores">
    <div class="store-badge"><!-- Apple icon --> App Store</div>
    <div class="store-badge"><!-- Play icon --> Google Play</div>
  </div>
  <div class="cta-btn">Download Free</div>
  <div class="free-note">Free on iOS & Android</div>
  <div class="brand-bottom">motovault.app</div>
</div>
```

```css
.s7 { display:flex;flex-direction:column;align-items:center;justify-content:center; }
.bg { position:absolute;inset:0;background:radial-gradient(circle at 30% 40%,rgba(59,130,246,0.08) 0%,transparent 50%),radial-gradient(circle at 70% 60%,rgba(34,197,94,0.06) 0%,transparent 50%),radial-gradient(circle at 50% 100%,rgba(139,92,246,0.04) 0%,transparent 40%); }
.logo-big { position:relative;z-index:2;width:88px;height:88px;border-radius:24px;object-fit:cover;margin-bottom:36px;box-shadow:0 12px 48px rgba(0,0,0,0.4); }
.cta-title { position:relative;z-index:2;color:#fafafa;font-size:54px;font-weight:800;text-align:center;line-height:1.12;margin-bottom:16px;max-width:700px; }
.cta-title span { background:linear-gradient(135deg,#3b82f6,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.cta-sub { position:relative;z-index:2;color:#a3a3a3;font-size:22px;text-align:center;margin-bottom:48px;line-height:1.5; }
.cta-btn { position:relative;z-index:2;background:linear-gradient(135deg,#D4622E,#E8723A);color:#fff;font-size:22px;font-weight:700;padding:20px 64px;border-radius:100px;border:none;box-shadow:0 12px 48px rgba(212,98,46,0.3);margin-bottom:24px; }
.stores { position:relative;z-index:2;display:flex;gap:24px;align-items:center;margin-bottom:12px; }
.store-badge { display:flex;align-items:center;gap:8px;padding:10px 24px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#d4d4d4;font-size:15px;font-weight:600; }
.free-note { position:relative;z-index:2;color:#22c55e;font-size:16px;font-weight:600;margin-top:8px; }
.brand-bottom { position:absolute;bottom:44px;z-index:2;color:#404040;font-size:16px;font-weight:600; }
```

## Store Badge SVG Icons

Apple icon:
```html
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
```

Play icon:
```html
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
```
