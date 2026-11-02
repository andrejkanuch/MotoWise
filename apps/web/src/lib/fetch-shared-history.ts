import { ABSENT_OR_MALFORMED_CODES, postPublicQuery } from './public-graphql';
import { asUpstream } from './upstream-error';

const API_URL = process.env.API_URL ?? 'https://motowise.onrender.com/graphql';

const SHARED_BIKE_HISTORY_QUERY = `
  query SharedBikeHistory($token: String!) {
    sharedBikeHistory(token: $token) {
      bike {
        make
        model
        year
        nickname
      }
      tasks {
        title
        status
        priority
        dueDate
        completedAt
        completedMileage
        notes
        photoUrls
      }
      generatedAt
    }
  }
`;

interface SharedBikeInfo {
  make: string;
  model: string;
  year: number;
  nickname?: string;
}

interface SharedTaskInfo {
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  completedAt?: string;
  completedMileage?: number;
  notes?: string;
  photoUrls: string[];
}

export interface SharedBikeHistory {
  bike: SharedBikeInfo;
  tasks: SharedTaskInfo[];
  generatedAt: string;
}

const SHARE_REVALIDATE_SECONDS = 60;

// `null` only when the API answered that the link is gone; anything else
// (network failure, timeout, non-200, another GraphQL error) throws
// `UpstreamError` so the page says "didn't load", not "expired", to a rider
// whose link is fine.
export async function fetchSharedHistory(token: string): Promise<SharedBikeHistory | null> {
  const data = await asUpstream(
    postPublicQuery<{ sharedBikeHistory: SharedBikeHistory | null }>(
      API_URL,
      SHARED_BIKE_HISTORY_QUERY,
      { token },
      SHARE_REVALIDATE_SECONDS,
      // The resolver rejects a malformed token with BAD_REQUEST: the link is gone.
      ABSENT_OR_MALFORMED_CODES,
    ),
    'shared history',
  );
  return data?.sharedBikeHistory ?? null;
}
