/**
 * Author registry for blog posts and feature pages.
 *
 * Honest defaults only — do not fabricate credentials, social handles, or
 * years of experience. This file is the single source of truth for bylines
 * and E-E-A-T signals on the marketing site.
 */

export interface Author {
  id: string;
  name: string;
  role: string;
  bio: string;
  credentials: string[];
  avatarUrl?: string;
  socials?: {
    x?: string;
    linkedin?: string;
    instagram?: string;
  };
}

export const authors: Record<string, Author> = {
  founder: {
    id: 'founder',
    name: 'Andrej Kanuch',
    role: 'Founder & Rider',
    bio: 'Motorcyclist and software engineer. Built MotoVault after three seasons of juggling five apps on real multi-day trips across Europe.',
    credentials: [
      'Riding since 2019',
      'Tested MotoVault on 6+ multi-day trips in the Dolomites, Alps, and Carpathians',
      'Full-stack engineer — built the app end-to-end',
    ],
    socials: {},
  },
};

export function getAuthor(id: string): Author | undefined {
  return authors[id];
}

export function getDefaultAuthor(): Author {
  return authors.founder;
}
