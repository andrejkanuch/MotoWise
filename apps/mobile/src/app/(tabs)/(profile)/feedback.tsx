import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FeedbackScreen } from '@/features/feedback/feedback-screen';

export default function FeedbackRoute() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('feedback.title'), headerLargeTitle: false }} />
      <FeedbackScreen />
    </>
  );
}
