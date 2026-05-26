import { memo } from 'react';
import { View } from 'react-native';
import { CARD_VARIANTS, type CardVariant, type RideSharePayload } from '../share-card-types';
import { EditorialDarkCard } from './editorial-dark-card';
import { ElevationStoryCard } from './elevation-story-card';
import { MapHeroCard } from './map-hero-card';
import { MapStyleCard } from './map-style-card';
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
      case CARD_VARIANTS.mapSatellite:
        return <MapStyleCard data={payload} variant="satellite" />;
      case CARD_VARIANTS.mapHybrid:
        return <MapStyleCard data={payload} variant="hybrid" />;
      case CARD_VARIANTS.map3D:
        return <MapStyleCard data={payload} variant="terrain3D" />;
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
