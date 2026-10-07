// Shared UI for the read-only web garage/profile and the web → app handoff.
// Spec: features/web-garage-redesign/DATA-MAP.md (what data may render).

export { AppHandoffBand, AppHandoffBar, AppHandoffRail } from './app-handoff';
export {
  BetterInAppCard,
  BetterInAppDensity,
  BetterInAppLayout,
  BetterInAppList,
  usePromotedCopy,
} from './better-in-app';
export { AppleMark, GoogleMark, GooglePlayMark } from './brand-icons';
export {
  APP_BAR_DISMISS_KEY,
  APP_HANDOFF_DISPLAY,
  APP_HANDOFF_URL,
  buildQrPath,
  calmReasonsFor,
  DEFAULT_CALM_REASONS,
  type HandoffAccount,
  HandoffReason,
  type PromotedHandoff,
  type PromotionSignals,
  pickPromotedHandoff,
  SignInMethod,
  signInMethodFromProvider,
} from './handoff';
export {
  CardPadding,
  CardTone,
  GarageCard,
  MonoLabel,
  SerifAccent,
  Skeleton,
} from './primitives';
export { QrCode, QrSize } from './qr-code';
export {
  CopyLinkField,
  QrHandoff,
  QrHandoffVariant,
  SignInHint,
  SignInText,
} from './qr-handoff';
export { StoreButtons, StoreTextLinks } from './store-buttons';
