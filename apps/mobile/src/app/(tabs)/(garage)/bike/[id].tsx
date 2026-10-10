import { useLocalSearchParams } from 'expo-router';
import { BikeHubScreen } from '@/components/bike-hub/shell/bike-hub-screen';

/** Route params of the bike hub. All but `id` are optional landing hints. */
type BikeRouteParams = {
  id: string;
  /** Task to expand on the Service segment. */
  highlightTask?: string;
  /** Segment to land on (`BIKE_SEGMENT`). */
  segment?: string;
  /** Where the rider came from (`BIKE_ORIGIN`) — drives the back destination. */
  from?: string;
  /** Fresh on every `router.navigate` from Home so an already-mounted screen re-lands. */
  _ts?: string;
};

export default function BikeDetailScreen() {
  const { id, highlightTask, segment, from, _ts } = useLocalSearchParams<BikeRouteParams>();
  return (
    <BikeHubScreen
      // A different bike is a different screen: reset segment and scroll state.
      key={id}
      id={id}
      highlightTask={highlightTask}
      segment={segment}
      from={from}
      ts={_ts}
    />
  );
}
