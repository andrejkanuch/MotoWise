import { palette } from '@motovault/design-system';
import type { GetCommentsQuery } from '@motovault/graphql';
import { Image } from 'expo-image';
import { Reply } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { showActionSheet } from '../../utils/action-sheet';

type CommentData = GetCommentsQuery['getComments']['comments'][number];
type ReplyData = NonNullable<CommentData['replies']>[number];

interface CommentItemProps {
  comment: CommentData | ReplyData;
  index: number;
  isReply?: boolean;
  currentUserId?: string;
  onReply?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onFlag?: (commentId: string) => void;
  onAuthorPress?: (username: string) => void;
}

export const CommentItem = memo(function CommentItem({
  comment,
  index,
  isReply = false,
  currentUserId,
  onReply,
  onDelete,
  onFlag,
  onAuthorPress,
}: CommentItemProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const isOwn = currentUserId === comment.author.id;

  const textColor = isDark ? palette.neutral200 : palette.neutral800;
  const nameColor = isDark ? palette.white : palette.neutral950;
  const timeColor = isDark ? palette.neutral500 : palette.neutral400;
  const actionColor = isDark ? palette.neutral500 : palette.neutral400;
  const avatarBg = isDark ? palette.primary700 : palette.primary200;
  const avatarTextColor = isDark ? palette.primary200 : palette.primary700;

  const initial = comment.author.displayName?.charAt(0)?.toUpperCase() ?? '?';
  const timeAgo = formatTimeAgo(comment.createdAt);

  const handleLongPress = useCallback(() => {
    showActionSheet(
      isOwn ? 'Delete comment?' : 'Report comment?',
      [
        {
          label: isOwn ? 'Delete' : 'Report',
          onPress: () => {
            if (isOwn) onDelete?.(comment.id);
            else onFlag?.(comment.id);
          },
          style: 'destructive',
        },
        { label: 'Cancel', onPress: () => {}, style: 'cancel' },
      ],
      isOwn ? 'This action cannot be undone.' : 'This comment will be reviewed by our team.',
    );
  }, [comment.id, isOwn, onDelete, onFlag]);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 30).duration(200)}
      style={{ marginLeft: isReply ? 40 : 0, marginBottom: 16 }}
    >
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {/* Avatar */}
        <Pressable
          onPress={() =>
            comment.author.publicUsername && onAuthorPress?.(comment.author.publicUsername)
          }
        >
          {comment.author.avatarUrl ? (
            <Image
              source={{ uri: comment.author.avatarUrl }}
              style={{ width: 32, height: 32, borderRadius: 16 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              recyclingKey={comment.id}
            />
          ) : (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: avatarBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: avatarTextColor }}>
                {initial}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Content */}
        <Pressable onLongPress={handleLongPress} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: nameColor }}>
              {comment.author.displayName}
            </Text>
            <Text style={{ fontSize: 11, color: timeColor }}>{timeAgo}</Text>
          </View>
          <Text style={{ fontSize: 14, lineHeight: 20, color: textColor }}>{comment.text}</Text>

          {/* Reply action (only on top-level comments) */}
          {!isReply && onReply && (
            <Pressable
              onPress={() => onReply(comment.id)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}
            >
              <Reply size={14} color={actionColor} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: actionColor }}>
                {t('comments.reply')}
              </Text>
            </Pressable>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
});

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
