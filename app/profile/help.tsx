import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { spacing, fontSize, fontWeight, useAppThemeStyles } from '../../lib/sharedStyles';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export default function HelpSupportScreen() {
  const { t } = useTranslation();
  const { colors } = useAppThemeStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const faqItems: FAQItem[] = useMemo(
    () => [
      {
        id: '1',
        question: t('howToCreateRequest'),
        answer: t('howToCreateRequestAnswer'),
      },
      {
        id: '2',
        question: t('howToSubmitBid'),
        answer: t('howToSubmitBidAnswer'),
      },
      {
        id: '3',
        question: t('howPaymentWorks'),
        answer: t('howPaymentWorksAnswer'),
      },
      {
        id: '4',
        question: t('howToTrackOrder'),
        answer: t('howToTrackOrderAnswer'),
      },
      {
        id: '5',
        question: t('whatIfCarrierLate'),
        answer: t('whatIfCarrierLateAnswer'),
      },
      {
        id: '6',
        question: t('canICancelOrder'),
        answer: t('canICancelOrderAnswer'),
      },
    ],
    [t]
  );

  const handleContactSupport = async () => {
    const email = 'support@truckinfox.no';
    const subject = t('supportRequest');
    const body = t('pleaseDescribeIssue');

    try {
      const mailUrl = `mailto:${email}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;
      await Linking.openURL(mailUrl);
    } catch {
      Alert.alert(t('error'), t('couldNotOpenEmail'));
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert(t('error'), t('couldNotOpenLink'));
    }
  };

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('helpSupport')} showBackButton={true} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Contact Support Card */}
        <View style={styles.contactCard}>
          <View style={styles.contactHeader}>
            <Ionicons name="mail-outline" size={32} color={colors.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>{t('needHelp')}</Text>
              <Text style={styles.contactSubtitle}>{t('contactUsDirectly')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContactSupport}
            accessibilityRole="button"
            accessibilityLabel={t('contactSupport')}
          >
            <Text style={styles.contactButtonText}>{t('contactSupport')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('frequentlyAskedQuestions')}</Text>

          <View style={styles.faqContainer}>
            {faqItems.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity
                  style={styles.faqItem}
                  onPress={() => toggleFAQ(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={item.question}
                >
                  <View style={styles.faqHeader}>
                    <Ionicons
                      name={expandedFAQ === item.id ? 'chevron-down' : 'chevron-forward'}
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.faqQuestion}>{item.question}</Text>
                  </View>

                  {expandedFAQ === item.id && <Text style={styles.faqAnswer}>{item.answer}</Text>}
                </TouchableOpacity>

                {index < faqItems.length - 1 && <View style={styles.faqDivider} />}
              </View>
            ))}
          </View>
        </View>

        {/* Legal & Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legalAndInfo')}</Text>

          <View style={styles.legalContainer}>
            <TouchableOpacity
              style={styles.legalItem}
              onPress={() => handleOpenLink('https://truckinfox.no/terms')}
              accessibilityRole="button"
              accessibilityLabel={t('termsOfService')}
            >
              <Ionicons name="document-text-outline" size={24} color={colors.primary} />
              <View style={styles.legalTextContainer}>
                <Text style={styles.legalText}>{t('termsOfService')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>

            <View style={styles.legalDivider} />

            <TouchableOpacity
              style={styles.legalItem}
              onPress={() => handleOpenLink('https://truckinfox.no/privacy')}
              accessibilityRole="button"
              accessibilityLabel={t('privacyPolicy')}
            >
              <Ionicons name="shield-outline" size={24} color={colors.primary} />
              <View style={styles.legalTextContainer}>
                <Text style={styles.legalText}>{t('privacyPolicy')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>

            <View style={styles.legalDivider} />

            <TouchableOpacity
              style={styles.legalItem}
              onPress={() => handleOpenLink('https://truckinfox.no/about')}
              accessibilityRole="button"
              accessibilityLabel={t('about')}
            >
              <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
              <View style={styles.legalTextContainer}>
                <Text style={styles.legalText}>{t('about')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={styles.infoText}>{t('responseTimeInfo')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppThemeStyles>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.lg,
    },
    contactCard: {
      backgroundColor: colors.white,
      borderRadius: spacing.md,
      padding: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      gap: spacing.md,
    },
    contactHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    contactInfo: {
      flex: 1,
    },
    contactTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    contactSubtitle: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      marginTop: spacing.xs,
    },
    contactButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: `${colors.primary}10`,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: spacing.sm,
    },
    contactButtonText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.primary,
    },
    section: {
      gap: spacing.md,
    },
    sectionTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      marginLeft: spacing.xs,
    },
    faqContainer: {
      backgroundColor: colors.white,
      borderRadius: spacing.md,
      overflow: 'hidden',
    },
    faqItem: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    faqHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    faqQuestion: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    faqAnswer: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      lineHeight: 20,
      marginTop: spacing.md,
      marginLeft: spacing.lg + spacing.sm,
    },
    faqDivider: {
      height: 1,
      backgroundColor: colors.border.default,
    },
    legalContainer: {
      backgroundColor: colors.white,
      borderRadius: spacing.md,
      overflow: 'hidden',
    },
    legalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    legalTextContainer: {
      flex: 1,
    },
    legalText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    legalDivider: {
      height: 1,
      backgroundColor: colors.border.default,
      marginHorizontal: spacing.md,
    },
    infoBox: {
      backgroundColor: `${colors.info}15`,
      borderLeftWidth: 3,
      borderLeftColor: colors.info,
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: spacing.md,
      borderRadius: spacing.sm,
      gap: spacing.md,
    },
    infoText: {
      flex: 1,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      lineHeight: 18,
    },
  });
