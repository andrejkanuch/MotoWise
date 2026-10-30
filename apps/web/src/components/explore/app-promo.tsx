import { BikePlate } from '@/components/marketing/bike-plate';
import { StoreLink } from '@/components/marketing/store-buttons';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';

/**
 * The app hand-off: a deeper step of the ramp (not a card), one copper
 * action, a ghost secondary, and the Bike Plate as the shared object.
 */
export function AppPromo() {
  return (
    <section className="xp-band">
      <div className="xp-wrap xp-band-grid">
        <div>
          <h2 className="mv-h2">Take the route with you</h2>
          <p className="xp-sub">Open any route in the app, ride it, and keep the record.</p>
          <div className="xp-cta-row">
            <StoreLink
              platform={StorePlatform.Ios}
              pageType={CtaPageType.Explore}
              placement={CtaPlacement.Inline}
              className="mv-btn mv-btn-primary"
            >
              Download for iOS
            </StoreLink>
            <StoreLink
              platform={StorePlatform.Android}
              pageType={CtaPageType.Explore}
              placement={CtaPlacement.Inline}
              className="mv-btn mv-btn-ghost"
            >
              Download for Android
            </StoreLink>
          </div>
        </div>
        {/* The demo bike's one ledger: the same figures as the home hero plate */}
        <div className="xp-band-plate">
          <BikePlate
            figure="24,318"
            unit="km"
            caption="Ready · chain service in 1,882 km"
            racingNumber="27"
            identity="Africa Twin · 2022"
            state="ready"
          />
        </div>
      </div>
    </section>
  );
}
