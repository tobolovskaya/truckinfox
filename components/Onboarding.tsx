import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { colors, fontSize, fontWeight, spacing } from '../lib/sharedStyles';

interface OnboardingStep {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  color: string;
}

interface OnboardingProps {
  visible: boolean;
  onComplete: () => void;
  userType?: 'customer' | 'carrier';
}

export function Onboarding({ visible, onComplete, userType = 'customer' }: OnboardingProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  const customerSteps: OnboardingStep[] = [
    {
      icon: 'cube-outline',
      title: t('onboarding.step1.title') || 'Opprett lastforespørsel',
      description:
        t('onboarding.step1.description') ||
        'Legg ut din last med detaljer om henting, levering og vekt. Få tilbud fra verifiserte transportører.',
      color: '#FF7043',
    },
    {
      icon: 'pricetags-outline',
      title: t('onboarding.step2.title') || 'Motta og sammenlign bud',
      description:
        t('onboarding.step2.description') ||
        'Transportører sender inn bud. Sammenlign priser, vurderinger og velg den beste.',
      color: '#42A5F5',
    },
    {
      icon: 'chatbubbles-outline',
      title: t('onboarding.step3.title') || 'Kommuniser og spor',
      description:
        t('onboarding.step3.description') ||
        'Chat direkte med transportør. Følg sendingen i sanntid med GPS-sporing.',
      color: '#66BB6A',
    },
    {
      icon: 'shield-checkmark-outline',
      title: t('onboarding.step4.title') || 'Sikker betaling',
      description:
        t('onboarding.step4.description') ||
        'Betaling holdes i escrow til levering. Dine penger er trygge.',
      color: '#9C27B0',
    },
  ];

  const carrierSteps: OnboardingStep[] = [
    {
      icon: 'search-outline',
      title: t('onboarding.carrier.step1.title') || 'Finn lastforespørsler',
      description:
        t('onboarding.carrier.step1.description') ||
        'Bla gjennom aktive lastforespørsler. Filtrer etter sted, type og vekt.',
      color: '#FF7043',
    },
    {
      icon: 'cash-outline',
      title: t('onboarding.carrier.step2.title') || 'Send inn bud',
      description:
        t('onboarding.carrier.step2.description') ||
        'Sett din pris og legg til en melding. Vis hvorfor du er det beste valget.',
      color: '#42A5F5',
    },
    {
      icon: 'car-outline',
      title: t('onboarding.carrier.step3.title') || 'Start transport',
      description:
        t('onboarding.carrier.step3.description') ||
        'Når budet ditt aksepteres, hent lasten og lever trygt.',
      color: '#66BB6A',
    },
    {
      icon: 'star-outline',
      title: t('onboarding.carrier.step4.title') || 'Bygg omdømme',
      description:
        t('onboarding.carrier.step4.description') ||
        'Få positive vurderinger og øk din rating. Høyere rating = flere oppdrag.',
      color: '#9C27B0',
    },
  ];

  const steps = userType === 'carrier' ? carrierSteps : customerSteps;
  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <LinearGradient colors={['#FFFFFF', '#F5F5F5']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>{t('skip') || 'Hopp over'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: step.color + '20' }]}>
            <Ionicons name={step.icon} size={80} color={step.color} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{step.title}</Text>

          {/* Description */}
          <Text style={styles.description}>{step.description}</Text>

          {/* Step indicators */}
          <View style={styles.indicators}>
            {steps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  {
                    backgroundColor: index === currentStep ? step.color : '#E0E0E0',
                    width: index === currentStep ? 32 : 8,
                  },
                ]}
              />
            ))}
          </View>
        </ScrollView>

        {/* Navigation */}
        <View style={styles.footer}>
          {currentStep > 0 && (
            <TouchableOpacity onPress={handlePrevious} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNext}
            style={[styles.nextButton, currentStep === 0 && styles.nextButtonSingle]}
          >
            <LinearGradient
              colors={[step.color, step.color + 'DD']}
              style={styles.nextButtonGradient}
            >
              <Text style={styles.nextButtonText}>
                {currentStep === steps.length - 1
                  ? t('getStarted') || 'Kom i gang'
                  : t('next') || 'Neste'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-end',
  },
  skipButton: {
    padding: spacing.sm,
  },
  skipText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xxl,
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  indicator: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  nextButtonSingle: {
    flex: 1,
  },
  nextButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  nextButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: 'white',
  },
});
