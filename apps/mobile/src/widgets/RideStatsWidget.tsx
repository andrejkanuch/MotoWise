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

type RideStatsWidgetProps = {
  hasData: boolean;
  // 7-day primary
  weekDistance: string;
  weekDistanceUnit: string;
  weekRides: string;
  // 30-day secondary
  monthDistance: string;
  monthDistanceUnit: string;
  monthRides: string;
  // 14 bar heights (0-100)
  bar0: number;
  bar1: number;
  bar2: number;
  bar3: number;
  bar4: number;
  bar5: number;
  bar6: number;
  bar7: number;
  bar8: number;
  bar9: number;
  bar10: number;
  bar11: number;
  bar12: number;
  bar13: number;
  deepLink: string;
};

function RideStatsWidget(props: RideStatsWidgetProps, _env: WidgetEnvironment) {
  'widget';

  const MAX_BAR = 36;
  const barHeight = (v: number) => (v > 0 ? Math.max(3, Math.round((v / 100) * MAX_BAR)) : 0);

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
        containerBackground('#faf5ed', 'widget'),
        padding({ all: 14 }),
        widgetURL(props.deepLink),
      ]}
    >
      {/* Header row */}
      <HStack>
        <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
          LAST 7 DAYS
        </Text>
        <Spacer />
        <RoundedRectangle
          cornerRadius={4}
          modifiers={[frame({ width: 18, height: 18 }), foregroundStyle('#D4622E')]}
        />
      </HStack>

      {/* Main content: distance + bars */}
      <HStack modifiers={[padding({ top: 2 })]}>
        {/* Left: big distance */}
        <VStack>
          <HStack>
            <Text
              modifiers={[
                font({ size: 36, weight: 'regular', design: 'serif' }),
                foregroundStyle('#2c2824'),
              ]}
            >
              {props.weekDistance}
            </Text>
            <Text
              modifiers={[
                font({ size: 12, weight: 'medium' }),
                foregroundStyle('#8e8880'),
                padding({ bottom: 6 }),
              ]}
            >
              {` ${props.weekDistanceUnit}`}
            </Text>
          </HStack>
          <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#8e8880')]}>
            {props.weekRides}
          </Text>
        </VStack>

        <Spacer />

        {/* Right: 14-day bar chart (inline — no sub-components in widget directive) */}
        <HStack spacing={3} modifiers={[padding({ top: 8 })]}>
          {barHeight(props.bar0) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar0) }),
                  foregroundStyle('#c4bdb2'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar1) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar1) }),
                  foregroundStyle('#c4bdb2'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar2) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar2) }),
                  foregroundStyle('#c4bdb2'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar3) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar3) }),
                  foregroundStyle('#c4bdb2'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar4) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar4) }),
                  foregroundStyle('#c4bdb2'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar5) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar5) }),
                  foregroundStyle('#c4bdb2'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar6) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar6) }),
                  foregroundStyle('#c4bdb2'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar7) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar7) }),
                  foregroundStyle('#D4622E'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar8) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar8) }),
                  foregroundStyle('#D4622E'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar9) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar9) }),
                  foregroundStyle('#D4622E'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar10) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar10) }),
                  foregroundStyle('#D4622E'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar11) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar11) }),
                  foregroundStyle('#D4622E'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar12) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar12) }),
                  foregroundStyle('#D4622E'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
          {barHeight(props.bar13) > 0 ? (
            <VStack modifiers={[frame({ width: 6, height: MAX_BAR, alignment: 'bottom' })]}>
              <Spacer />
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[
                  frame({ width: 6, height: barHeight(props.bar13) }),
                  foregroundStyle('#D4622E'),
                ]}
              />
            </VStack>
          ) : (
            <Spacer modifiers={[frame({ width: 6, height: MAX_BAR })]} />
          )}
        </HStack>
      </HStack>

      <Spacer />

      {/* Bottom: 30D summary */}
      <HStack>
        <VStack>
          <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
            30 D
          </Text>
          <HStack modifiers={[padding({ top: 1 })]}>
            <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle('#2c2824')]}>
              {props.monthDistance}
            </Text>
            <Text modifiers={[font({ size: 9, weight: 'medium' }), foregroundStyle('#8e8880')]}>
              {` ${props.monthDistanceUnit}`}
            </Text>
          </HStack>
        </VStack>

        <Spacer modifiers={[frame({ width: 24 })]} />

        <VStack>
          <Text modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('#8e8880')]}>
            RIDES
          </Text>
          <Text
            modifiers={[
              font({ size: 15, weight: 'semibold' }),
              foregroundStyle('#2c2824'),
              padding({ top: 1 }),
            ]}
          >
            {props.monthRides}
          </Text>
        </VStack>

        <Spacer />
      </HStack>
    </VStack>
  );
}

export default createWidget<RideStatsWidgetProps>('RideStatsWidget', RideStatsWidget);
