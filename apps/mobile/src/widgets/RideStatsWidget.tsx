import { Divider, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

type RideStatsWidgetProps = {
  hasData: boolean;
  weekDistance: string;
  weekDistanceUnit: string;
  weekRides: string;
  monthDistance: string;
  monthDistanceUnit: string;
  monthRides: string;
  weekLabel: string;
  monthLabel: string;
  deepLink: string;
};

function RideStatsWidget(props: RideStatsWidgetProps, _env: WidgetEnvironment) {
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
          Start riding to see stats
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#8e8880')]}>Open MotoVault</Text>
        <Spacer />
      </VStack>
    );
  }

  return (
    <VStack
      modifiers={[
        frame({ maxWidth: 99999, maxHeight: 99999, alignment: 'leading' }),
        containerBackground('#1c1814', 'widget'),
        padding({ all: 16 }),
        widgetURL(props.deepLink),
      ]}
    >
      {/* Eyebrow */}
      <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
        {props.weekLabel.toUpperCase()}
      </Text>

      <HStack modifiers={[padding({ top: 2 })]}>
        {/* Left — primary (this week) */}
        <VStack>
          <HStack>
            <Text
              modifiers={[
                font({ size: 44, weight: 'regular', design: 'serif' }),
                foregroundStyle('#faf5ed'),
              ]}
            >
              {props.weekDistance}
            </Text>
            <Text
              modifiers={[
                font({ size: 13, weight: 'medium' }),
                foregroundStyle('#c4bdb2'),
                padding({ bottom: 8 }),
              ]}
            >
              {` ${props.weekDistanceUnit}`}
            </Text>
          </HStack>
          <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#8e8880')]}>
            {props.weekRides}
          </Text>

          {/* Month stats below divider */}
          <Divider
            modifiers={[padding({ top: 10, bottom: 8 }), foregroundStyle('rgba(255,255,255,0.06)')]}
          />

          <HStack>
            {/* 30d distance */}
            <VStack>
              <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
                {props.monthLabel.toUpperCase()}
              </Text>
              <HStack modifiers={[padding({ top: 2 })]}>
                <Text
                  modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle('#faf5ed')]}
                >
                  {props.monthDistance}
                </Text>
                <Text modifiers={[font({ size: 9, weight: 'medium' }), foregroundStyle('#8e8880')]}>
                  {` ${props.monthDistanceUnit}`}
                </Text>
              </HStack>
            </VStack>

            <Spacer />

            {/* Month rides */}
            <VStack>
              <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
                RIDES
              </Text>
              <Text
                modifiers={[
                  font({ size: 16, weight: 'semibold' }),
                  foregroundStyle('#faf5ed'),
                  padding({ top: 2 }),
                ]}
              >
                {props.monthRides}
              </Text>
            </VStack>
          </HStack>
        </VStack>

        <Spacer />
      </HStack>
    </VStack>
  );
}

export default createWidget<RideStatsWidgetProps>('RideStatsWidget', RideStatsWidget);
