type MetaPixelStandardEvent =
  | 'AddPaymentInfo'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'CompleteRegistration'
  | 'Contact'
  | 'CustomizeProduct'
  | 'Donate'
  | 'FindLocation'
  | 'InitiateCheckout'
  | 'Lead'
  | 'PageView'
  | 'Purchase'
  | 'Schedule'
  | 'Search'
  | 'StartTrial'
  | 'SubmitApplication'
  | 'Subscribe'
  | 'ViewContent';

interface MetaPixelContentParams {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  currency?: string;
  value?: number;
  search_string?: string;
  status?: boolean;
  [key: string]: unknown;
}

interface Window {
  fbq: {
    (command: 'init', pixelId: string): void;
    (command: 'track', event: MetaPixelStandardEvent, params?: MetaPixelContentParams): void;
    (command: 'trackCustom', event: string, params?: Record<string, unknown>): void;
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[];
    loaded: boolean;
    version: string;
    push: (...args: unknown[]) => void;
  };
  _fbq?: Window['fbq'];
}
