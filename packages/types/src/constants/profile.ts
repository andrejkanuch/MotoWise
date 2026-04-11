export const RESERVED_USERNAMES = [
  'admin',
  'support',
  'motovault',
  'help',
  'api',
  'www',
  'app',
  'system',
  'rider',
  'ride',
  'feed',
  'profile',
  'settings',
  'login',
  'signup',
  'register',
  'password',
  'reset',
  'verify',
  'webhook',
  'graphql',
  'health',
  'report',
  'affiliate',
  'static',
  'assets',
  '_next',
  'robots',
  'sitemap',
  'favicon',
] as const;

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 160;
export const CITY_MAX_LENGTH = 100;
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;
