import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

type LastRideWidgetProps = {
  hasData: boolean;
  rideName: string;
  rideSubtitle: string;
  distance: string;
  distanceUnit: string;
  duration: string;
  durationUnit: string;
  avgSpeed: string;
  avgSpeedUnit: string;
  date: string;
  deepLink: string;
};

function LastRideWidget(props: LastRideWidgetProps, _env: WidgetEnvironment) {
  'widget';

  if (!props.hasData) {
    return (
      <VStack
        modifiers={[
          frame({ maxWidth: 99999, maxHeight: 99999 }),
          containerBackground('#1c1814', 'widget'),
          padding({ all: 16 }),
        ]}
      >
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#faf5ed')]}>
          Complete your first ride
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#8e8880')]}>Open MotoVault</Text>
        <Spacer />
      </VStack>
    );
  }

  return (
    <HStack
      modifiers={[
        frame({ maxWidth: 99999, maxHeight: 99999 }),
        containerBackground('#1c1814', 'widget'),
        widgetURL(props.deepLink),
      ]}
    >
      {/* Left — ride info */}
      <VStack modifiers={[frame({ maxHeight: 99999, alignment: 'leading' }), padding({ all: 16 })]}>
        {/* Eyebrow */}
        <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
          {props.date.toUpperCase()}
        </Text>

        {/* Ride name */}
        <Text
          modifiers={[
            font({ size: 22, weight: 'regular', design: 'serif' }),
            foregroundStyle('#faf5ed'),
            padding({ top: 2 }),
          ]}
        >
          {props.rideName}
        </Text>
        {props.rideSubtitle ? (
          <Text
            modifiers={[
              font({ size: 22, weight: 'regular', design: 'serif' }),
              foregroundStyle('#E8A060'),
            ]}
          >
            {props.rideSubtitle}
          </Text>
        ) : null}

        <Spacer />

        {/* Three stats */}
        <HStack>
          {/* Distance */}
          <VStack>
            <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
              DIST
            </Text>
            <HStack>
              <Text
                modifiers={[font({ size: 20, weight: 'semibold' }), foregroundStyle('#faf5ed')]}
              >
                {props.distance}
              </Text>
              <Text modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle('#8e8880')]}>
                {` ${props.distanceUnit}`}
              </Text>
            </HStack>
          </VStack>

          <Spacer />

          {/* Duration */}
          <VStack>
            <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
              TIME
            </Text>
            <HStack>
              <Text
                modifiers={[font({ size: 20, weight: 'semibold' }), foregroundStyle('#faf5ed')]}
              >
                {props.duration}
              </Text>
              <Text modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle('#8e8880')]}>
                {` ${props.durationUnit}`}
              </Text>
            </HStack>
          </VStack>

          <Spacer />

          {/* Avg speed */}
          <VStack>
            <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
              AVG
            </Text>
            <HStack>
              <Text
                modifiers={[font({ size: 20, weight: 'semibold' }), foregroundStyle('#faf5ed')]}
              >
                {props.avgSpeed}
              </Text>
              <Text modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle('#8e8880')]}>
                {` ${props.avgSpeedUnit}`}
              </Text>
            </HStack>
          </VStack>
        </HStack>
      </VStack>
    </HStack>
  );
}

export default createWidget<LastRideWidgetProps>('LastRideWidget', LastRideWidget);
