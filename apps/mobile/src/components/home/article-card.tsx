import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, ChevronRight, Eye } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { CardWrapper } from './card-wrapper';

interface ArticleCardProps {
  article: {
    id: string;
    title: string;
    difficulty: string;
    viewCount: number;
  };
  diffColor: string;
  index: number;
  onPress: () => void;
}

export function ArticleCard({ article, diffColor, index, onPress }: ArticleCardProps) {
  return (
    <Animated.View entering={FadeInUp.delay(420 + index * 50).duration(300)}>
      <CardWrapper tier="medium" style={{ width: 220, overflow: 'hidden' }}>
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios')
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${article.title}, ${article.difficulty}`}
        >
          <LinearGradient
            colors={[`${diffColor}20`, `${diffColor}08`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              height: 96,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookOpen size={28} color={diffColor} strokeWidth={1.5} />
          </LinearGradient>
          <View style={{ padding: 12 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
              }}
              className="text-neutral-950 dark:text-neutral-50"
              numberOfLines={2}
            >
              {article.title}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    backgroundColor: `${diffColor}20`,
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderCurve: 'continuous',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: diffColor,
                      textTransform: 'capitalize',
                    }}
                  >
                    {article.difficulty}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Eye size={10} color={palette.neutral400} strokeWidth={2} />
                  <Text style={{ fontSize: 10, color: palette.neutral400 }}>
                    {article.viewCount}
                  </Text>
                </View>
              </View>
              <ChevronRight size={12} color={palette.neutral400} strokeWidth={2} />
            </View>
          </View>
        </Pressable>
      </CardWrapper>
    </Animated.View>
  );
}
