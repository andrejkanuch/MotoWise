---
name: motovault-social
description: >
  Create social media content for MotoVault — the AI-powered motorcycle learning & diagnostics app.
  Generates Instagram carousels, single posts, and story-format content using real app screenshots
  and the established dark-theme brand style. Can suggest post ideas based on app features or
  execute a specific idea from the user. Use this skill whenever the user mentions creating social
  media posts, Instagram carousels, marketing visuals, promotional content, or social graphics
  for MotoVault. Also trigger when the user says "create a post", "promote a feature",
  "marketing content", "social media", "carousel", or "Instagram" in the context of MotoVault.
---

# MotoVault Social Content Creator

You create polished social media content for MotoVault using real app screenshots, the established
dark-theme brand aesthetic, and proven carousel structures from previous posts.

## Before you start

1. Read `references/design-system.md` for the exact visual style (colors, fonts, CSS patterns)
2. Read `references/app-features.md` to understand available features and where screenshots live
3. Read `references/slide-templates.md` for the HTML slide patterns you should follow

These references are essential — the visual consistency of MotoVault's social presence depends
on matching the established style exactly.

## Workflow

### 1. Understand the request

The user will either:
- **Give you an idea** ("create a carousel about the Garage feature")
- **Ask you to suggest ideas** ("what should we post next?")

If they ask for ideas, consult `references/app-features.md` and propose 2-3 post concepts,
each with a working title, the feature it highlights, and the angle (e.g., pain-point → solution,
feature walkthrough, before/after). Let them pick before proceeding.

If they provide an idea, confirm the feature focus and content type before diving in.

### 2. Gather the right screenshots

Every post should use real app screenshots, not placeholder mockups. Screenshots live in two places:

- `marketing/` — Simulator captures and existing carousel assets
- `apps/web/public/images/features/` — Feature screenshots from the web app

Check both locations. Run `ls` commands to find the most relevant screenshots for the chosen
feature. Copy them into the output carousel directory with short descriptive names (e.g.,
`garage.png`, `expenses.png`). Also copy the logo from `marketing/MotoVault-logo.png`.

If no suitable screenshot exists for a particular screen, note it to the user and suggest they
capture one, or use the closest available alternative.

### 3. Plan the slide structure

Carousels follow a proven 5-7 slide structure:

| Slide | Purpose | Layout |
|-------|---------|--------|
| 1 | **Cover** — Bold headline + feature badge + single phone screenshot | Centered, vertical stack |
| 2 | **Problem** — Pain points the audience relates to | Icon + question headline + pain-point cards |
| 3-5 | **Solution steps** — Feature walkthrough with screenshots | Text left + phone right, or phone left + text right (alternate) |
| 6 | **Bonus / combo** — Extra features or two screenshots side by side | Centered heading + two phones |
| 7 | **CTA** — Download prompt with App Store + Google Play badges | Centered, logo + headline + button |

For **single posts**, create just slide 1 (the cover) with a strong standalone headline.
For **stories**, create 1080x1920 vertical format instead of 1080x1080 square.

### 4. Write the HTML slides

Each slide is a standalone HTML file sized at **1080×1350px (4:5)** for carousels and
feed posts, or 1080×1920 for stories. 4:5 is Instagram's highest-performing feed ratio —
it takes ~25% more vertical screen space than 1:1 and is the maximum height IG will show
in-feed without cropping. All slides in a carousel must share the same aspect ratio
(Instagram locks to the first slide), so start every carousel at 1080×1350.

Follow the exact CSS patterns in `references/slide-templates.md` — these have been refined
across multiple carousels and produce consistent, professional results.

Key rules:
- Always use relative paths for images (screenshots should be in the same directory)
- Every slide gets the shared base CSS (font import, reset, body dimensions, phone-img styling)
- The cover slide (slide 1) has no slide number; all other slides show "N / total" in the top-right
- Vary the accent color per step badge to create visual rhythm (blue, green, orange, purple)

### 5. Write the caption

Write an Instagram caption that:
- Opens with a hook (one punchy line, optionally with one relevant emoji)
- Lists key feature benefits using → arrows (not bullet points)
- Ends with a CTA ("Link in bio" or "Download MotoVault")
- Includes 10-20 relevant hashtags as a separate block

Also write a short alternative caption for stories/reels (2-3 lines max).

### 6. Capture PNG screenshots

After creating all HTML slides, use Playwright to capture them as 1080×1350 PNG files
(or 1080×1920 for stories). Run the bundled capture script:

```bash
# Carousel / feed post (4:5)
python3 <skill-path>/scripts/capture_slides.py <carousel-directory>

# Story (9:16)
python3 <skill-path>/scripts/capture_slides.py <story-directory> --height 1920
```

The script defaults to 1080×1350 (4:5) since that's the recommended feed format.

This script finds all `slide-*.html` files in the directory, opens each in a headless browser,
and saves a matching `.png` file. If Playwright isn't installed, install it first:

```bash
pip3 install playwright --break-system-packages && python3 -m playwright install chromium
```

### 7. Create the caption file

Save a `caption.md` file in the carousel directory with:
- The Instagram caption
- Hashtags
- Alternative short caption
- Slide breakdown table (slide number, file, content summary)
- Specs (dimensions, brand colors used, font)

### 8. Deliver

Save all files to `marketing/carousel-<feature-name>/` (for carousels) or
`marketing/post-<feature-name>/` (for single posts).

Present the PNG files to the user so they can preview the visuals directly, along with a
summary of the slide flow and caption.

### 9. Publish (optional)

Once the user approves the visuals, the carousel can be published directly to Instagram
and Facebook via the social worker at `infra/social-worker/`. Three endpoints are
available (all require `X-Auth-Key: $WORKER_AUTH_KEY`):

- `POST /publish-post` — single-image feed post (1 image)
- `POST /publish-carousel` — multi-image album (2–10 slides)
- `POST /publish-story` — 9:16 story

For a carousel, base64-encode each slide PNG in order and POST:

```bash
curl -X POST "$WORKER_URL/publish-carousel" \
  -H "X-Auth-Key: $WORKER_AUTH_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "images_base64": ["<slide-1>", "<slide-2>", "..."],
    "caption": "<caption from caption.md>",
    "platform": "both"
  }'
```

The worker uploads each slide to Supabase Storage, forces pixel-exact 1080×1350 via the
render endpoint, creates per-slide IG child containers, waits for each to finalize,
assembles the parent CAROUSEL container, and publishes. Facebook gets the same images as
a native multi-photo feed post. Always smoke-test with 2 throwaway slides and
`"platform": "instagram"` before burning a real carousel on a bug.

## Content voice

MotoVault's social voice is:
- **Confident but not salesy** — state what the app does, don't oversell
- **Rider-first** — speak to the pain points and passion of motorcycle owners
- **Technical but accessible** — mention AI, health scores, diagnostics without jargon overload
- **Action-oriented** — every post should end with a clear next step

Avoid: generic startup language ("revolutionary", "game-changing"), excessive emojis (max 1-2
per caption), filler phrases ("in today's world").

## Output directory structure

```
marketing/carousel-<feature>/
├── slide-1-cover.html
├── slide-1-cover.png
├── slide-2-problem.html
├── slide-2-problem.png
├── slide-3-*.html / .png
├── ...
├── slide-7-cta.html / .png
├── caption.md
├── logo.png
└── <screenshot>.png (copied from source)
```
