'use client';

import { useState } from 'react';

const FAQ_ITEMS = [
  {
    question: 'What is MotoVault?',
    answer:
      'MotoVault is a free iOS and Android app that unifies the four things every motorcycle rider needs into a single platform: multi-day trip planning with turn-by-turn navigation, predictive maintenance tracking, per-bike expense management, and AI-powered photo diagnostics. The app supports over 12,000 motorcycle models sourced from the NHTSA vPIC Database, covering every major manufacturer from the last 30 years. Riders can plan routes, log service history, photograph mechanical issues for instant AI analysis, and track total cost of ownership across their entire garage. No OBD-II hardware is required, and no subscription is needed to get started. MotoVault was built by riders who were tired of juggling five separate apps for tasks that belong together. Source: NHTSA vPIC Database for model catalog.',
  },
  {
    question: 'Is MotoVault really free?',
    answer:
      'MotoVault is free forever for its core feature set, which includes unlimited bikes in your garage, full maintenance tracking with service history, expense logging with per-bike cost breakdowns, ride recording with GPS traces, the trip planner with up to three saved routes, and five AI diagnostic scans per month. There is no trial period and no feature lockout after 30 days. MotoVault Pro costs $4 per month or $36 per year and unlocks unlimited AI diagnostic scans, advanced rider analytics with weekly performance reports, unlimited GPX exports, priority route processing, and extended ride statistics with elevation data. Every feature needed to maintain and manage your motorcycle is included on the free tier with no artificial limitations.',
  },
  {
    question: 'How does AI diagnostics work?',
    answer:
      'MotoVault AI diagnostics is powered by Claude AI vision model from Anthropic, one of the most advanced multimodal AI systems available. To use it, open the diagnostic camera within the app, frame the part, warning light, or area of concern, and tap the shutter button. The vision model identifies what it is looking at, cross-references known failure modes for your specific motorcycle make and model, and returns a structured diagnosis including probable cause, severity rating, and a recommended next step. Most results appear in under five seconds. The system provides a confidence rating of low, medium, or high for each assessment. AI diagnostics is designed to help you understand potential issues and decide urgency, not to replace a qualified motorcycle mechanic for complex repairs.',
  },
  {
    question: 'What motorcycles does MotoVault support?',
    answer:
      'MotoVault supports every major motorcycle make and model manufactured in the last 30 years, totaling over 12,000 distinct models in the database. Model specifications including engine displacement, service intervals, and recommended fluids load automatically when you add a bike to your garage. Coverage spans all major manufacturers including Honda, Yamaha, Kawasaki, Suzuki, BMW, Ducati, KTM, Harley-Davidson, Triumph, Royal Enfield, Aprilia, and Indian. The model catalog is sourced from the NHTSA Vehicle Product Information Catalog, which is the United States federal government authoritative database for vehicle identification. If your specific model is not listed, you can add any custom motorcycle manually with your own service intervals. Source: NHTSA Vehicle Product Information Catalog, maintained by the National Highway Traffic Safety Administration.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'MotoVault takes data security seriously with enterprise-grade protections applied to every rider account. All data including ride GPS traces, maintenance records, expense logs, and diagnostic images is encrypted in transit using TLS 1.3 and encrypted at rest using AES-256 on EU-hosted infrastructure. The platform is fully GDPR-compliant, meaning European riders have complete data portability and right-to-erasure protections. You can export your entire history as structured data or delete everything permanently with a single tap in settings. MotoVault never sells rider data to third parties, never shares location history with advertisers, and never uses your diagnostic photos for purposes other than generating your result. Row-level security ensures each rider can only access their own records, even at the database layer.',
  },
  {
    question: 'How does trip planning work?',
    answer:
      'MotoVault trip planning lets you build multi-day motorcycle routes with typed waypoints that riders actually need: fuel stops, scenic overlooks, border crossings, ferry terminals, restaurants, and overnight accommodations. Each waypoint type displays its own icon on the map for quick visual scanning. The planner includes elevation profiles so you can anticipate mountain passes and plan for altitude changes that affect engine performance. Routes can be rearranged with drag-and-drop, and the system calculates estimated fuel stops based on your specific bike tank capacity. Once finalized, any route exports as a standard GPX file for offline use on Garmin, TomTom, or any compatible GPS unit. Pro users get unlimited saved routes, while free accounts can store up to three active trip plans at any time.',
  },
  {
    question: 'Can I use MotoVault offline?',
    answer:
      'MotoVault works offline for the features that matter most when you are on the road without cell service. Ride recording continues to log GPS coordinates, speed, elevation, and duration using your phone sensors with no data connection required. You can also log maintenance entries and expenses while offline, and all entries will sync automatically once your device reconnects. Trip plans that were previously loaded are available for viewing offline as well. The data synchronization is conflict-free, meaning edits made offline and online will merge cleanly without data loss. The one feature that requires an active internet connection is AI diagnostics, because the image must reach the cloud-based vision model for analysis. All other core functions work reliably in remote areas.',
  },
  {
    question: 'How is MotoVault different from REVER or Calimoto?',
    answer:
      'REVER and Calimoto are excellent navigation-focused apps, but they each solve only one piece of the motorcycle ownership puzzle. MotoVault is an all-in-one platform that combines trip planning, maintenance tracking, expense management, and AI-powered diagnostics into a single app with a unified garage. Instead of switching between Calimoto for routes, a spreadsheet for expenses, a notes app for service history, and Google for diagnosing warning lights, MotoVault handles all four in one place. This means your fuel expense data informs your trip planner range estimates, your maintenance history feeds into diagnostic context, and your ride recordings automatically update odometer readings for service reminders. The integrated approach eliminates duplicate data entry and gives you a complete picture of each motorcycle you own.',
  },
  {
    question: 'What maintenance reminders does MotoVault send?',
    answer:
      'MotoVault sends smart maintenance reminders based on either mileage or time elapsed, whichever threshold you reach first. Standard service categories include oil and filter changes, chain cleaning and adjustment, tire inspection and replacement, brake pad wear, coolant flush, valve clearance checks, air filter replacement, and spark plug service. Each reminder adapts to your specific motorcycle service schedule rather than using generic intervals, because a sportbike at track days needs oil changes far more frequently than a touring bike on highways. When you add a bike with a supported model, recommended intervals pre-populate from manufacturer specifications. You can customize any interval, add custom service categories unique to your bike, and snooze reminders when a service has already been scheduled with your mechanic.',
  },
  {
    question: 'Can I track expenses for multiple bikes?',
    answer:
      'MotoVault supports unlimited motorcycles on the free tier with no restrictions, and every expense is tagged to a specific bike in your garage. You can track fuel fill-ups with automatic cost-per-mile calculation, insurance premiums, gear purchases, replacement parts, service labor costs, registration fees, and any custom expense category you define. Each bike displays its own running total, monthly averages, and fuel economy trends over time. At the end of each year, MotoVault generates an annual cost report per bike showing your total cost of ownership broken down by category. This makes it straightforward to compare which bikes are most expensive to run, decide when selling makes financial sense, or simply keep accurate records for resale value documentation and tax purposes.',
  },
  {
    question: 'Does MotoVault work with OBD-II scanners?',
    answer:
      'MotoVault does not require OBD-II hardware, Bluetooth adapters, diagnostic cables, or any external scanning device. The AI diagnostic feature works entirely through your smartphone camera, which means you can photograph a part, warning light, fluid leak, or any visible issue and receive an AI-generated assessment without purchasing additional equipment. This approach was chosen deliberately because most motorcycles either lack standard OBD-II ports, use proprietary diagnostic connectors, or require manufacturer-specific scan tools that cost hundreds of dollars. By using computer vision instead of hardware protocols, MotoVault diagnostics works on any motorcycle regardless of age, manufacturer, or electronic sophistication. Simply point your camera at the concern, and the AI vision model analyzes what it sees against known failure patterns for your specific bike.',
  },
  {
    question: 'Can I export my ride data as GPX?',
    answer:
      'MotoVault supports GPX export for both recorded rides and planned trip routes. Every ride you record with GPS tracking can be exported as a standard GPX file containing the full track with timestamps, elevation data, and speed. Trip plans created in the route planner also export as GPX route files, which can be imported directly into Garmin Zumo, TomTom Rider, Hammerhead Karoo, or any GPS navigation unit that accepts GPX format. Free accounts include five GPX exports per month, which covers most riders needs for occasional sharing or device transfer. MotoVault Pro unlocks unlimited exports with no monthly cap. Exported GPX files are compliant with the GPX 1.1 specification and work with third-party tools including Google Earth, Strava, Komoot, and Basecamp without modification.',
  },
  {
    question: 'What countries are motorcycle routes available in?',
    answer:
      'MotoVault routes are available across more than 40 countries worldwide, with the strongest coverage in the United States, Germany, Austria, Switzerland, Italy, France, Spain, and Norway. These countries have the most complete road data including surface type indicators, elevation accuracy, and curvature ratings that help identify the most enjoyable riding roads. Coverage also extends across the United Kingdom, Portugal, Greece, Croatia, the Czech Republic, Canada, Mexico, Argentina, Brazil, Colombia, Australia, New Zealand, Japan, and Thailand. Community-contributed routes are growing daily as riders share their favorite roads and touring itineraries through the app. Route coverage depends on OpenStreetMap road data quality for each region, which means well-mapped European and North American roads have the richest metadata for motorcycle-specific routing.',
  },
  {
    question: 'How accurate is the AI diagnostic feature?',
    answer:
      'MotoVault AI diagnostics provides each assessment with a confidence rating of low, medium, or high so you can judge reliability at a glance. High-confidence results typically involve clearly visible issues like worn brake pads, damaged chain links, leaking fluids with identifiable color, or standard dashboard warning lights. Medium-confidence results indicate the AI detected a probable issue but recommends professional verification. Low-confidence results mean the image was ambiguous or the issue requires physical inspection beyond what is visible in a photograph. The AI diagnostic feature is explicitly not a replacement for a qualified motorcycle mechanic. It is best used for identifying potential issues before they worsen, understanding what dashboard warning lights mean for your specific model, and deciding whether a problem requires immediate attention or can wait until your next scheduled service appointment.',
  },
  {
    question: 'Is there a desktop or web version?',
    answer:
      'MotoVault offers a web application at motovault.app that provides trip planning and route browsing on a full-size screen, which many riders prefer for planning multi-day tours where a larger map view is helpful. The web app lets you create waypoints, adjust routes, review elevation profiles, and export GPX files from your desktop or laptop computer. However, the core mobile features including maintenance logging, expense tracking, ride recording with GPS, and AI photo diagnostics remain mobile-only by design. These features are built for use at the motorcycle, in the garage, or at the fuel pump where a phone is the natural interface. Your garage and trip data syncs between web and mobile, so routes planned at your desk are immediately available on your phone when you head out to ride.',
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section
      id="faq"
      style={{
        padding: '120px 40px 160px',
        maxWidth: '960px',
        margin: '0 auto',
      }}
    >
      {/* Split header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: '80px',
          alignItems: 'end',
        }}
        className="faq-head-grid"
      >
        <div>
          <div className="mv-section-meta">FAQ &middot; 02</div>
          <h2 className="mv-section-title">
            Questions, <span className="mv-serif mv-muted">answered.</span>
          </h2>
        </div>
        <p
          style={{
            margin: 0,
            color: 'var(--mv-ink-2)',
            fontSize: '18px',
            lineHeight: 1.55,
            maxWidth: '620px',
            letterSpacing: '-0.01em',
          }}
        >
          Everything you&apos;d ask in the first five minutes. If we missed yours,{' '}
          <a
            href="mailto:support@motovault.app"
            style={{ color: 'var(--mv-warm-400)', textDecoration: 'none' }}
          >
            write to us
          </a>
          .
        </p>
      </div>

      {/* Accordion */}
      <div style={{ marginTop: '64px', borderTop: '1px solid var(--mv-line)' }}>
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question} style={{ borderBottom: '1px solid var(--mv-line)' }}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                style={{
                  width: '100%',
                  padding: '32px 0',
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: '22px',
                  fontWeight: 400,
                  letterSpacing: '-0.025em',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'color .25s',
                }}
                id={`faq-question-${index}`}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${index}`}
              >
                {item.question}
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: isOpen ? '1px solid var(--mv-warm-500)' : '1px solid var(--mv-line)',
                    display: 'grid',
                    placeItems: 'center',
                    color: isOpen ? 'var(--mv-bg)' : 'var(--mv-ink-3)',
                    background: isOpen ? 'var(--mv-warm-500)' : 'transparent',
                    transition:
                      'transform .4s var(--mv-ease-expo), background .3s, border-color .3s, color .3s',
                    flexShrink: 0,
                    marginLeft: '20px',
                    transform: isOpen ? 'rotate(45deg)' : 'none',
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </button>
              <section
                id={`faq-answer-${index}`}
                aria-labelledby={`faq-question-${index}`}
                style={{
                  maxHeight: isOpen ? '1200px' : '0',
                  overflow: 'hidden',
                  transition: 'max-height .5s var(--mv-ease-expo)',
                }}
              >
                <div
                  style={{
                    padding: '0 0 32px',
                    color: 'var(--mv-ink-2)',
                    fontSize: '16px',
                    lineHeight: 1.6,
                    maxWidth: '680px',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {item.answer}
                </div>
              </section>
            </div>
          );
        })}
      </div>

      {/* Responsive */}
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 820px) {
              .faq-head-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
            }
          `,
        }}
      />
    </section>
  );
}
