import { palette } from '@motovault/design-system';
import { BookOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ArticleCard } from './article-card';
import { DIFFICULTY_COLORS } from './home-helpers';
import { SectionHeader } from './section-header';

interface ArticleCarouselProps {
  articles: {
    node: {
      id: string;
      slug: string;
      title: string;
      difficulty: string;
      category: string;
      viewCount: number;
    };
  }[];
  isDark: boolean;
  onViewAll: () => void;
  onArticlePress: () => void;
}

export function ArticleCarousel({
  articles,
  isDark,
  onViewAll,
  onArticlePress,
}: ArticleCarouselProps) {
  const { t } = useTranslation();

  if (articles.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(380).duration(300)}>
      <Animated.View style={{ paddingHorizontal: 20 }}>
        <SectionHeader
          icon={BookOpen}
          iconColor={palette.primary500}
          title={t('home.recommendedForYou')}
          actionLabel={t('home.viewAll')}
          onActionPress={onViewAll}
          isDark={isDark}
        />
      </Animated.View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        snapToInterval={232}
        decelerationRate="fast"
      >
        {articles.map((edge, index) => {
          const article = edge.node;
          const diffColor =
            DIFFICULTY_COLORS[article.difficulty as keyof typeof DIFFICULTY_COLORS] ??
            palette.neutral400;
          return (
            <ArticleCard
              key={article.id}
              article={article}
              diffColor={diffColor}
              index={index}
              onPress={onArticlePress}
            />
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}
