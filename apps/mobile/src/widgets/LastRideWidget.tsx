import { HStack, RoundedRectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
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
  dayLabel: string;
  distanceLabel: string;
  deepLink: string;
};

function LastRideWidget(props: LastRideWidgetProps, _env: WidgetEnvironment) {
  'widget';

  if (!props || !props.hasData) {
    return (
      <VStack
        modifiers={[
          frame({ maxWidth: 99999, maxHeight: 99999 }),
          containerBackground('#faf5ed', 'widget'),
          padding({ all: 16 }),
        ]}
      >
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#2c2824')]}>
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
        containerBackground('#faf5ed', 'widget'),
        widgetURL(props.deepLink),
      ]}
    >
      {/* Left: date badge area */}
      <VStack modifiers={[frame({ width: 100, maxHeight: 99999 }), padding({ all: 14 })]}>
        <Spacer />
        <RoundedRectangle
          cornerRadius={8}
          modifiers={[frame({ height: 26 }), foregroundStyle('rgba(44,40,36,0.08)')]}
        />
        <Text
          modifiers={[
            font({ size: 10, weight: 'bold' }),
            foregroundStyle('#2c2824'),
            padding({ top: -22 }),
          ]}
        >
          {props.date}
        </Text>
        <Spacer />
      </VStack>

      {/* Right: ride info */}
      <VStack
        modifiers={[
          frame({ maxHeight: 99999, alignment: 'leading' }),
          padding({ vertical: 14, trailing: 14 }),
        ]}
      >
        {/* Eyebrow + icon */}
        <HStack>
          <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
            {props.dayLabel}
          </Text>
          <Spacer />
          <RoundedRectangle
            cornerRadius={4}
            modifiers={[frame({ width: 18, height: 18 }), foregroundStyle('#D4622E')]}
          />
        </HStack>

        {/* Ride name */}
        <Text
          modifiers={[
            font({ size: 18, weight: 'regular', design: 'serif' }),
            foregroundStyle('#2c2824'),
            padding({ top: 1 }),
          ]}
        >
          {props.rideName}
        </Text>
        {props.rideSubtitle ? (
          <Text
            modifiers={[
              font({ size: 18, weight: 'regular', design: 'serif' }),
              foregroundStyle('#D4622E'),
            ]}
          >
            {props.rideSubtitle}
          </Text>
        ) : null}

        <Spacer />

        {/* Stats row */}
        <HStack spacing={16}>
          <VStack>
            <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
              DIST
            </Text>
            <HStack>
              <Text
                modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle('#2c2824')]}
              >
                {props.distance}
              </Text>
              <Text modifiers={[font({ size: 9, weight: 'medium' }), foregroundStyle('#8e8880')]}>
                {props.distanceUnit}
              </Text>
            </HStack>
          </VStack>

          <VStack>
            <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
              TIME
            </Text>
            <HStack>
              <Text
                modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle('#2c2824')]}
              >
                {props.duration}
              </Text>
              <Text modifiers={[font({ size: 9, weight: 'medium' }), foregroundStyle('#8e8880')]}>
                h
              </Text>
            </HStack>
          </VStack>

          <VStack>
            <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
              AVG
            </Text>
            <HStack>
              <Text
                modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle('#2c2824')]}
              >
                {props.avgSpeed}
              </Text>
              <Text modifiers={[font({ size: 9, weight: 'medium' }), foregroundStyle('#8e8880')]}>
                {props.avgSpeedUnit}
              </Text>
            </HStack>
          </VStack>
        </HStack>
      </VStack>
    </HStack>
  );
}

export default createWidget<LastRideWidgetProps>('LastRideWidget', LastRideWidget);
