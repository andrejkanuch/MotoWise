import { palette } from '@motolearn/design-system';
import { CreateQuizAttemptDocument, GetQuizByArticleDocument } from '@motolearn/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ArrowRight, CheckCircle, Trophy, XCircle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { queryKeys } from '../../../../lib/query-keys';

const QUIZ_STATES = {
  answering: 'answering',
  submitting: 'submitting',
  results: 'results',
} as const;

type QuizState = (typeof QUIZ_STATES)[keyof typeof QUIZ_STATES];

export default function QuizScreen() {
  const { t } = useTranslation();
  const { id: articleId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizState, setQuizState] = useState<QuizState>(QUIZ_STATES.answering);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    data: quizData,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.quizzes.byArticle(articleId ?? ''),
    queryFn: () => gqlFetcher(GetQuizByArticleDocument, { articleId: articleId ?? '' }),
    enabled: !!articleId,
  });

  const quiz = quizData?.quizByArticle;
  const questions = quiz?.questions ?? [];
  const totalQuestions = questions.length;
  const question = questions[currentQuestion];
  const answeredCount = Object.keys(selectedAnswers).length;
  const allAnswered = answeredCount === totalQuestions;

  const submitMutation = useMutation({
    mutationFn: (answers: number[]) =>
      gqlFetcher(CreateQuizAttemptDocument, {
        input: { quizId: quiz?.id ?? '', answers },
      }),
    onSuccess: () => {
      setQuizState(QUIZ_STATES.results);
      queryClient.invalidateQueries({ queryKey: queryKeys.progress.all });
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (err: Error) => {
      setSubmitError(err.message ?? t('common.error'));
      setQuizState(QUIZ_STATES.answering);
    },
  });

  const handleSelectOption = useCallback(
    (optionIndex: number) => {
      if (quizState !== QUIZ_STATES.answering) return;
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setSelectedAnswers((prev) => ({ ...prev, [currentQuestion]: optionIndex }));
    },
    [currentQuestion, quizState],
  );

  const handleNext = useCallback(() => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  }, [currentQuestion, totalQuestions]);

  const handlePrevious = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  }, [currentQuestion]);

  const handleSubmit = useCallback(() => {
    if (!allAnswered || !quiz) return;
    setSubmitError(null);
    setQuizState(QUIZ_STATES.submitting);

    const answers = Array.from({ length: totalQuestions }, (_, i) => selectedAnswers[i] ?? 0);
    submitMutation.mutate(answers);
  }, [allAnswered, quiz, totalQuestions, selectedAnswers, submitMutation]);

  const handleFinish = useCallback(() => {
    router.back();
  }, [router]);

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center">
        <ActivityIndicator size="large" color={palette.primary500} />
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">
          {t('quiz.loading')}
        </Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center p-5">
        <AlertCircle size={48} color={palette.danger500} strokeWidth={1.5} />
        <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center mt-3">
          {t('quiz.loadError')}
        </Text>
        <Pressable
          className="mt-4 bg-primary-500 rounded-xl px-6 py-3"
          style={{ borderCurve: 'continuous' }}
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold text-sm">{t('common.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  // Empty quiz state
  if (!quiz || totalQuestions === 0) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center p-5">
        <AlertCircle size={48} color={palette.neutral400} strokeWidth={1.5} />
        <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center mt-3">
          {t('quiz.noQuestions')}
        </Text>
        <Pressable
          className="mt-4 bg-primary-500 rounded-xl px-6 py-3"
          style={{ borderCurve: 'continuous' }}
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold text-sm">{t('common.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  // Results screen
  if (quizState === QUIZ_STATES.results && submitMutation.data) {
    const result = submitMutation.data.submitQuiz;
    const scorePercent = Math.round((result.score / result.totalQuestions) * 100);
    const isPassing = scorePercent >= 70;

    return (
      <View className="flex-1 bg-white dark:bg-neutral-900">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          {/* Score Card */}
          <Animated.View entering={FadeIn.duration(300)} className="px-5 pt-6 items-center">
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <View
                className={`w-24 h-24 rounded-full items-center justify-center ${
                  isPassing ? 'bg-green-100 dark:bg-green-900' : 'bg-orange-100 dark:bg-orange-900'
                }`}
              >
                <Trophy
                  size={40}
                  color={isPassing ? palette.success500 : palette.warning500}
                  strokeWidth={1.5}
                />
              </View>
            </Animated.View>

            <Animated.Text
              entering={FadeInUp.delay(400).duration(300)}
              className="text-4xl font-bold text-neutral-950 dark:text-neutral-50 mt-4"
            >
              {scorePercent}%
            </Animated.Text>

            <Animated.Text
              entering={FadeInUp.delay(500).duration(300)}
              className="text-base text-neutral-500 dark:text-neutral-400 mt-1"
            >
              {t('quiz.scoreLabel', { score: result.score, total: result.totalQuestions })}
            </Animated.Text>

            <Animated.Text
              entering={FadeInUp.delay(600).duration(300)}
              className={`text-lg font-semibold mt-2 ${
                isPassing
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-orange-600 dark:text-orange-400'
              }`}
            >
              {isPassing ? t('quiz.passed') : t('quiz.keepLearning')}
            </Animated.Text>
          </Animated.View>

          {/* Question Review */}
          <Animated.View entering={FadeInUp.delay(700).duration(400)} className="px-5 mt-8">
            <Text className="text-lg font-bold text-neutral-950 dark:text-neutral-50 mb-4">
              {t('quiz.review')}
            </Text>
            {questions.map((q, index) => (
              <Animated.View
                key={`review-${q.question}`}
                entering={FadeInUp.delay(800 + index * 50).duration(300)}
                className="mb-4"
              >
                <View
                  className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-4"
                  style={{ borderCurve: 'continuous' }}
                >
                  <Text className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-2">
                    {t('quiz.questionNumber', { number: index + 1 })} {q.question}
                  </Text>
                  <Text className="text-sm text-neutral-600 dark:text-neutral-300 mb-1">
                    {t('quiz.yourAnswer')}{' '}
                    {q.options[selectedAnswers[index] ?? 0] ?? t('quiz.noAnswer')}
                  </Text>
                  <View className="flex-row items-start gap-1.5 mt-2 bg-primary-50 dark:bg-primary-950 rounded-xl p-3">
                    <CheckCircle size={14} color={palette.primary500} strokeWidth={2} />
                    <Text className="text-xs text-primary-700 dark:text-primary-300 flex-1">
                      {q.explanation}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            ))}
          </Animated.View>

          {/* Finish Button */}
          <Animated.View entering={FadeInUp.delay(1000).duration(300)} className="px-5 mt-4">
            <Pressable
              className="bg-primary-500 rounded-2xl py-4 items-center"
              style={{ borderCurve: 'continuous' }}
              onPress={handleFinish}
            >
              <Text className="text-white font-semibold text-base">{t('quiz.backToArticle')}</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // Answering / Submitting screen
  return (
    <View className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Bar */}
        <Animated.View entering={FadeIn.duration(300)} className="px-5 pt-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {t('quiz.questionProgress', {
                current: currentQuestion + 1,
                total: totalQuestions,
              })}
            </Text>
            <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {t('quiz.answeredCount', { count: answeredCount, total: totalQuestions })}
            </Text>
          </View>
          <View className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <View
              className="h-full bg-primary-500 rounded-full"
              style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
            />
          </View>
        </Animated.View>

        {/* Submit Error */}
        {submitError && (
          <Animated.View entering={FadeInUp.duration(300)} className="px-5 mt-3">
            <View
              className="bg-red-50 dark:bg-red-950 rounded-xl p-3 flex-row items-center gap-2"
              style={{ borderCurve: 'continuous' }}
            >
              <XCircle size={16} color={palette.danger500} strokeWidth={2} />
              <Text className="text-sm text-red-700 dark:text-red-300 flex-1">{submitError}</Text>
            </View>
          </Animated.View>
        )}

        {/* Question */}
        {question && (
          <Animated.View
            key={`question-${currentQuestion}`}
            entering={SlideInRight.duration(250)}
            className="px-5 mt-6"
          >
            <Text className="text-xl font-bold text-neutral-950 dark:text-neutral-50 mb-6">
              {question.question}
            </Text>

            {/* Options */}
            <View className="gap-3">
              {question.options.map((option, optionIndex) => {
                const isSelected = selectedAnswers[currentQuestion] === optionIndex;
                return (
                  <Animated.View
                    key={`option-${option}`}
                    entering={FadeInUp.delay(optionIndex * 50).duration(300)}
                  >
                    <Pressable
                      className={`rounded-2xl p-4 flex-row items-center gap-3 ${
                        isSelected
                          ? 'bg-primary-50 dark:bg-primary-950 border-2 border-primary-500'
                          : 'bg-neutral-50 dark:bg-neutral-800 border-2 border-transparent'
                      }`}
                      style={{ borderCurve: 'continuous' }}
                      onPress={() => handleSelectOption(optionIndex)}
                      disabled={quizState === QUIZ_STATES.submitting}
                    >
                      <View
                        className={`w-8 h-8 rounded-full items-center justify-center ${
                          isSelected ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'
                        }`}
                      >
                        <Text
                          className={`text-sm font-bold ${
                            isSelected ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'
                          }`}
                        >
                          {String.fromCharCode(65 + optionIndex)}
                        </Text>
                      </View>
                      <Text
                        className={`flex-1 text-base ${
                          isSelected
                            ? 'text-primary-700 dark:text-primary-300 font-medium'
                            : 'text-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        {option}
                      </Text>
                      {isSelected && (
                        <CheckCircle size={20} color={palette.primary500} strokeWidth={2} />
                      )}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Navigation Buttons */}
        <Animated.View entering={FadeInUp.delay(250).duration(300)} className="px-5 mt-8">
          <View className="flex-row gap-3">
            {currentQuestion > 0 && (
              <Pressable
                className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl py-4 items-center"
                style={{ borderCurve: 'continuous' }}
                onPress={handlePrevious}
                disabled={quizState === QUIZ_STATES.submitting}
              >
                <Text className="text-neutral-700 dark:text-neutral-300 font-semibold text-base">
                  {t('quiz.previous')}
                </Text>
              </Pressable>
            )}

            {currentQuestion < totalQuestions - 1 ? (
              <Pressable
                className="flex-1 bg-primary-500 rounded-2xl py-4 items-center flex-row justify-center gap-2"
                style={{ borderCurve: 'continuous' }}
                onPress={handleNext}
              >
                <Text className="text-white font-semibold text-base">{t('quiz.next')}</Text>
                <ArrowRight size={18} color={palette.white} strokeWidth={2} />
              </Pressable>
            ) : (
              <Pressable
                className={`flex-1 rounded-2xl py-4 items-center ${
                  allAnswered ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700'
                }`}
                style={{ borderCurve: 'continuous' }}
                onPress={handleSubmit}
                disabled={!allAnswered || quizState === QUIZ_STATES.submitting}
              >
                {quizState === QUIZ_STATES.submitting ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Text
                    className={`font-semibold text-base ${
                      allAnswered ? 'text-white' : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {t('quiz.submit')}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Question Dots */}
        <Animated.View
          entering={FadeIn.delay(300).duration(300)}
          className="px-5 mt-6 flex-row justify-center gap-2"
        >
          {questions.map((_, index) => {
            const isAnswered = selectedAnswers[index] !== undefined;
            const isCurrent = index === currentQuestion;
            return (
              <Pressable
                key={`dot-${questions[index]?.question ?? index}`}
                onPress={() => setCurrentQuestion(index)}
                disabled={quizState === QUIZ_STATES.submitting}
              >
                <View
                  className={`w-3 h-3 rounded-full ${
                    isCurrent
                      ? 'bg-primary-500'
                      : isAnswered
                        ? 'bg-primary-200 dark:bg-primary-800'
                        : 'bg-neutral-200 dark:bg-neutral-700'
                  }`}
                />
              </Pressable>
            );
          })}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
