import { colors } from '@motolearn/design-system';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ProgressBar } from './progress-bar';

const POPULAR_MAKES = [
  'Honda',
  'Yamaha',
  'Kawasaki',
  'Suzuki',
  'Ducati',
  'BMW',
  'KTM',
  'Harley-Davidson',
  'Triumph',
  'Aprilia',
  'Indian',
  'Royal Enfield',
  'Husqvarna',
  'Moto Guzzi',
  'MV Agusta',
  'Benelli',
  'CFMoto',
  'Zero',
  'Can-Am',
  'Vespa',
] as const;

export default function SelectBikeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [year, setYear] = useState('');
  const [selectedMake, setSelectedMake] = useState<string | null>(null);
  const [makeSearch, setMakeSearch] = useState('');
  const [nickname, setNickname] = useState('');

  const filteredMakes = POPULAR_MAKES.filter((make) =>
    make.toLowerCase().includes(makeSearch.toLowerCase()),
  );

  const handleSelectMake = (make: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedMake(make);
  };

  const handleContinue = () => {
    router.push('/(onboarding)/riding-goals');
  };

  const handleSkip = () => {
    router.push('/(onboarding)/riding-goals');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary[950] }}>
      <ProgressBar step={2} total={4} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeInDown.duration(500)}
          style={{
            fontSize: 34,
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: 8,
          }}
        >
          {t('onboarding.addBikeTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(500)}
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.7)',
            marginBottom: 32,
          }}
        >
          {t('onboarding.addBikeSubtitle')}
        </Animated.Text>

        {/* Year input */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <TextInput
            value={year}
            onChangeText={setYear}
            placeholder={t('onboarding.yearPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            keyboardType="number-pad"
            maxLength={4}
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              fontSize: 17,
              color: '#FFFFFF',
              marginBottom: 20,
            }}
          />
        </Animated.View>

        {/* Make search */}
        <Animated.View entering={FadeInUp.delay(280).duration(400)}>
          <TextInput
            value={makeSearch}
            onChangeText={setMakeSearch}
            placeholder={t('onboarding.searchMake')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              fontSize: 17,
              color: '#FFFFFF',
              marginBottom: 12,
            }}
          />
        </Animated.View>

        {/* Makes chip grid */}
        <Animated.View entering={FadeInUp.delay(360).duration(400)}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {filteredMakes.map((make) => {
              const isSelected = selectedMake === make;
              return (
                <Pressable
                  key={make}
                  onPress={() => handleSelectMake(make)}
                  style={({ pressed }) => ({
                    backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: isSelected ? colors.primary[950] : '#FFFFFF',
                    }}
                  >
                    {make}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Model placeholder */}
        <Animated.View entering={FadeInUp.delay(440).duration(400)}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              marginBottom: 20,
              opacity: selectedMake ? 1 : 0.4,
            }}
          >
            <Text
              style={{
                fontSize: 17,
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              {t('onboarding.selectModel')}
            </Text>
          </View>
        </Animated.View>

        {/* Nickname */}
        <Animated.View entering={FadeInUp.delay(520).duration(400)}>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('onboarding.nicknamePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              fontSize: 17,
              color: '#FFFFFF',
            }}
          />
        </Animated.View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 48, gap: 12 }}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => ({
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            borderCurve: 'continuous',
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: colors.primary[950],
            }}
          >
            {t('onboarding.continue')}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => ({
            paddingVertical: 12,
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {t('onboarding.skipForNow')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
