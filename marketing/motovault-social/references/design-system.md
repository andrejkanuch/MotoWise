# MotoVault Social Media Design System

## Font

**Plus Jakarta Sans** — weights 400, 500, 600, 700, 800.

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
```

Always set `font-family: 'Plus Jakarta Sans', sans-serif` on the body.

## Color Palette

### Background & Surfaces


| Token       | Hex                      | Usage                             |
| ----------- | ------------------------ | --------------------------------- |
| bg          | `#0a0a0a`                | Slide background (always)         |
| card-bg     | `rgba(255,255,255,0.03)` | Pain point cards, feature boxes   |
| card-border | `rgba(255,255,255,0.06)` | Card borders, phone frame borders |


### Brand Colors


| Token           | Hex       | Usage                              |
| --------------- | --------- | ---------------------------------- |
| blue-500        | `#3b82f6` | Primary accent, links, step badges |
| blue-400        | `#60a5fa` | Gradient end, lighter blue text    |
| signature       | `#D4622E` | CTA buttons, signature orange      |
| signature-light | `#E8723A` | CTA gradient end                   |


### Semantic Colors


| Token  | Hex                   | Usage                                 |
| ------ | --------------------- | ------------------------------------- |
| green  | `#22c55e`             | Success, health, completion badges    |
| orange | `#f59e0b`             | Warning, expenses, urgency            |
| red    | `#ef4444`             | Error, danger, X icons in pain points |
| purple | `#8b5cf6` / `#a78bfa` | Alternative accent for variety        |


### Text Colors


| Token      | Hex                      | Usage                     |
| ---------- | ------------------------ | ------------------------- |
| white      | `#fafafa`                | Headlines, primary text   |
| gray-light | `#d4d4d4`                | Body text, descriptions   |
| gray-mid   | `#a3a3a3`                | Subtitles, secondary text |
| gray-dark  | `#525252`                | Slide numbers, "Swipe →"  |
| ghost      | `rgba(255,255,255,0.12)` | Slide counter numbers     |


## Slide Dimensions

- **Carousel / Single post**: 1080 × 1080px
- **Story**: 1080 × 1920px

## Base CSS Reset (every slide)

```css
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Plus Jakarta Sans',sans-serif; width:1080px; height:1080px; overflow:hidden; }
.slide { width:1080px; height:1080px; position:relative; overflow:hidden; background:#0a0a0a; }
```

## Phone Screenshot Styling

Phone screenshots are displayed as `<img>` tags with this styling:

```css
.phone-img {
  border-radius: 36px;
  border: 2px solid rgba(255,255,255,0.06);
}
```

When used in slides, phone images get a glow shadow. Match the shadow color to the slide's accent:

```css
/* Blue accent slide */
.phone .phone-img {
  width: 380px;
  box-shadow: 0 0 80px rgba(59,130,246,0.08), 0 30px 100px rgba(0,0,0,0.5);
}

/* Green accent slide */
.phone .phone-img {
  box-shadow: 0 0 80px rgba(34,197,94,0.08), 0 30px 100px rgba(0,0,0,0.5);
}
```

## Radial Background Glows

Every slide has at least one subtle radial gradient glow. The glow color matches the slide's accent:

```css
/* Large centered glow (cover/CTA slides) */
.bg1 {
  position:absolute; width:900px; height:900px; border-radius:50%;
  background:radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.02) 40%, transparent 70%);
  top:50%; left:50%; transform:translate(-50%,-50%);
}

/* Side-positioned glow (step slides) */
.bg {
  position:absolute; width:600px; height:600px; border-radius:50%;
  background:radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 60%);
  right:-80px; top:50%; transform:translateY(-50%);
}
```

## Typography Scale


| Element             | Size | Weight | Color                                         |
| ------------------- | ---- | ------ | --------------------------------------------- |
| Cover headline      | 64px | 800    | #fafafa, accent via gradient                  |
| Feature headline    | 44px | 800    | #fafafa                                       |
| CTA headline        | 54px | 800    | #fafafa, accent via gradient                  |
| Problem headline    | 50px | 800    | #fafafa                                       |
| Subtitle            | 22px | 400    | #a3a3a3                                       |
| Feature description | 19px | 400    | #a3a3a3                                       |
| Step badge          | 13px | 700    | accent color, uppercase, 1.5px letter-spacing |
| Pain point text     | 21px | 500    | #d4d4d4                                       |
| Slide counter       | 14px | 600    | rgba(255,255,255,0.12)                        |


## Gradient Text (for accent words in headlines)

```css
.title span {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

## Badge/Pill Styling

Step badges, feature badges, and labels use pill styling with accent color:

```css
.step-badge {
  display:inline-flex; align-items:center; gap:8px;
  padding:6px 16px; border-radius:100px;
  background:rgba(59,130,246,0.08);
  border:1px solid rgba(59,130,246,0.2);
  color:#60a5fa;
  font-size:13px; font-weight:700;
  letter-spacing:1.5px; text-transform:uppercase;
}
```

Swap the color values per slide to create visual rhythm:

- Slide 3: Blue (`#3b82f6` / `#60a5fa`)
- Slide 4: Green (`#22c55e`)
- Slide 5: Orange/amber (`#f59e0b`)
- Slide 6: Purple (`#8b5cf6` / `#a78bfa`)

## Pain Point Cards

```css
.pp {
  display:flex; align-items:center; gap:20px;
  padding:22px 30px;
  background:rgba(255,255,255,0.03);
  border:1px solid rgba(255,255,255,0.06);
  border-radius:18px;
  color:#d4d4d4; font-size:21px; font-weight:500;
}
.x {
  width:36px; height:36px; border-radius:50%;
  background:rgba(239,68,68,0.12);
  display:flex; align-items:center; justify-content:center;
  color:#ef4444; flex-shrink:0;
}
```

## CTA Button

```css
.cta-btn {
  background:linear-gradient(135deg, #D4622E, #E8723A);
  color:#fff; font-size:22px; font-weight:700;
  padding:20px 64px; border-radius:100px; border:none;
  box-shadow:0 12px 48px rgba(212,98,46,0.3);
}
```

## Store Badges

```css
.store-badge {
  display:flex; align-items:center; gap:8px;
  padding:10px 24px; border-radius:12px;
  background:rgba(255,255,255,0.06);
  border:1px solid rgba(255,255,255,0.1);
  color:#d4d4d4; font-size:15px; font-weight:600;
}
```

## Logo

The MotoVault logo is always loaded as an image (`logo.png`), never recreated in CSS.

- Cover slide: 40×40px with `border-radius:10px`, positioned bottom-left
- CTA slide: 88×88px with `border-radius:24px`, centered above headline

## Footer Elements

Cover slides have a brand bar at the bottom:

```css
.brand { position:absolute; bottom:44px; left:48px; }  /* Logo + "MotoVault" */
.swipe { position:absolute; bottom:48px; right:48px; color:#525252; font-size:14px; }  /* "Swipe →" */
```

CTA slides have the website URL centered at the bottom:

```css
.brand-bottom { position:absolute; bottom:44px; color:#404040; font-size:16px; font-weight:600; }
```

