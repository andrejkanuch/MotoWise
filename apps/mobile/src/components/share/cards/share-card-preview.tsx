import { memo } from 'react';
import { View } from 'react-native';
import { CARD_VARIANTS, type CardVariant, type RideSharePayload } from '../share-card-types';
import { EditorialDarkCard } from './editorial-dark-card';
import { ElevationStoryCard } from './elevation-story-card';
import { MapHeroCard } from './map-hero-card';
import { PbSpotlightCard } from './pb-spotlight-card';
import { RoutePrintCard } from './route-print-card';

interface ShareCardPreviewProps {
  variant: CardVariant;
  payload: RideSharePayload;
}

export const ShareCardPreview = memo(function ShareCardPreview({
  variant,
  payload,
}: ShareCardPreviewProps) {
  const card = (() => {
    switch (variant) {
      case CARD_VARIANTS.mapHero:
        return <MapHeroCard data={payload} />;
      case CARD_VARIANTS.editorialDark:
        return <EditorialDarkCard data={payload} />;
      case CARD_VARIANTS.pbSpotlight:
        return <PbSpotlightCard data={payload} />;
      case CARD_VARIANTS.routePrint:
        return <RoutePrintCard data={payload} />;
      case CARD_VARIANTS.elevationStory:
        return <ElevationStoryCard data={payload} />;
      default:
        return null;
    }
  })();

  return (
    <View
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.45,
        shadowRadius: 36,
        elevation: 12,
      }}
      accessibilityLabel={`${variant} card`}
    >
      {card}
    </View>
  );
});
