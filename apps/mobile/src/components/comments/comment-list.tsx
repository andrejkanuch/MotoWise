import { palette } from '@motovault/design-system';
import {
  CreateCommentDocument,
  DeleteCommentDocument,
  FlagCommentDocument,
  GetCommentsDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { MessageCircle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { CommentInput } from './comment-input';
import { CommentItem } from './comment-item';

interface CommentListProps {
  rideId?: string;
  routeId?: string;
  groupRideId?: string;
  tripId?: string;
}

export function CommentList({ rideId, routeId, groupRideId, tripId }: CommentListProps) {
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const [replyingTo, setReplyingTo] = useState<string | undefined>();

  const queryKey = rideId
    ? queryKeys.comments.byRide(rideId)
    : routeId
      ? queryKeys.comments.byRoute(routeId)
      : tripId
        ? queryKeys.comments.byTrip(tripId)
        : queryKeys.comments.byGroupRide(groupRideId ?? '');

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      gqlFetcher(GetCommentsDocument, {
        rideId: rideId ?? null,
        routeId: routeId ?? null,
        groupRideId: groupRideId ?? null,
        tripId: tripId ?? null,
        first: 50,
      }),
  });

  const comments = data?.getComments?.comments ?? [];
  const totalCount = data?.getComments?.totalCount ?? 0;

  const createMutation = useMutation({
    mutationFn: (variables: { text: string; parentCommentId?: string }) =>
      gqlFetcher(CreateCommentDocument, {
        input: {
          rideId: rideId ?? undefined,
          routeId: routeId ?? undefined,
          groupRideId: groupRideId ?? undefined,
          tripId: tripId ?? undefined,
          parentCommentId: variables.parentCommentId,
          text: variables.text,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
      setReplyingTo(undefined);
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => gqlFetcher(DeleteCommentDocument, { commentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });

  const flagMutation = useMutation({
    mutationFn: (commentId: string) => gqlFetcher(FlagCommentDocument, { commentId }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const handleSubmit = useCallback(
    (text: string) => {
      createMutation.mutate({ text, parentCommentId: replyingTo });
    },
    [createMutation, replyingTo],
  );

  const handleAuthorPress = useCallback((_username: string) => {
    // TODO: Navigate to rider profile when modal is implemented
    // router.push({ pathname: '/(modals)/rider-profile', params: { username } });
  }, []);

  const emptyColor = isDark ? palette.neutral500 : palette.neutral400;
  const headerColor = isDark ? palette.neutral300 : palette.neutral600;

  return (
    <View>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 12,
        }}
      >
        <MessageCircle size={16} color={headerColor} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: headerColor }}>
          Comments{totalCount > 0 ? ` (${totalCount})` : ''}
        </Text>
      </View>

      {/* Comments list */}
      <View style={{ paddingHorizontal: 16 }}>
        {isLoading && (
          <ActivityIndicator
            size="small"
            color={palette.accent500}
            style={{ paddingVertical: 20 }}
          />
        )}

        {!isLoading && comments.length === 0 && (
          <Text
            style={{
              fontSize: 14,
              color: emptyColor,
              textAlign: 'center',
              paddingVertical: 16,
            }}
          >
            No comments yet. Be the first!
          </Text>
        )}

        {comments.map((comment, index) => (
          <View key={comment.id}>
            <CommentItem
              comment={comment}
              index={index}
              currentUserId={userId}
              onReply={(id) => setReplyingTo(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onFlag={(id) => flagMutation.mutate(id)}
              onAuthorPress={handleAuthorPress}
            />
            {/* Replies */}
            {comment.replies?.map((reply, replyIndex) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                index={replyIndex}
                isReply
                currentUserId={userId}
                onDelete={(id) => deleteMutation.mutate(id)}
                onFlag={(id) => flagMutation.mutate(id)}
                onAuthorPress={handleAuthorPress}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Input */}
      <CommentInput
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(undefined)}
      />
    </View>
  );
}
