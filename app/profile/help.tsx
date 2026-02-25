import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export default function HelpSupportScreen() {
  const { t } = useTranslation();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const faqItems: FAQItem[] = [
    {
      id: '1',
      question: t('howToCreateRequest') || 'How do I create a cargo request?',
      answer: t('howToCreateRequestAnswer') || 'Navigate to the Create tab, fill in cargo details, set price, and submit. Carriers will then send bids for your cargo.',
    },
    {
      id: '2',
      question: t('howToSubmitBid') || 'How do I submit a bid?',
      answer: t('howToSubmitBidAnswer') || 'As a carrier, browse active cargo requests in the Browse tab, compare offers, and submit your bid with your price and message.',
    },
    {
      id: '3',
      question: t('howPaymentWorks') || 'How does payment work?',
      answer: t('howPaymentWorksAnswer') || 'Payment uses secure escrow. Your payment is held until delivery is confirmed. Carriers receive payment only after successful delivery.',
    },
    {
      id: '4',
      question: t('howToTrackOrder') || 'How can I track my order?',
      answer: t('howToTrackOrderAnswer') || 'Once a bid is accepted, you can track the cargo in real-time using GPS. Chat directly with the carrier for updates.',
    },
    {
      id: '5',
      question: t('whatIfCarrierLate') || 'What if the carrier is late?',
      answer: t('whatIfCarrierLateAnswer') || 'Contact the carrier immediately via chat. If the issue persists, contact our support team for assistance.',
    },
    {
      id: '6',
      question: t('canICancelOrder') || 'Can I cancel my order?',
      answer: t('canICancelOrderAnswer') || 'You can cancel before a bid is accepted. Once accepted, cancellation requires carrier consent and may incur fees.',
    },
  ];

  const handleContactSupport = async () => {
    const email = 'support@truckinfox.no';
    const subject = t('supportRequest') || 'Support Request';
    const body = t('pleaseDescribeIssue') || 'Please describe your issue here...';

    try {
      await Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    } catch (error) {
      Alert.alert(t('error'), t('couldNotOpenEmail') || 'Could not open email client');
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      Alert.alert(t('error'), t('couldNotOpenLink') || 'Could not open link');
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
              <Text style={styles.contactTitle}>{t('needHelp') || 'Need Help?'}</Text>
              <Text style={styles.contactSubtitle}>{t('contactUsDirectly') || 'Contact our support team'}</Text>
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
          <Text style={styles.sectionTitle}>{t('frequentlyAskedQuestions') || 'Frequently Asked Questions'}</Text>

          <View style={styles.faqContainer}>
            {faqItems.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity
                  style={styles.faqItem}
                  onPress={() => toggleFAQ(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Question: ${item.question}`}
                  accessibilityHint={expandedFAQ === item.id ? 'Double tap to collapse' : 'Double tap to expand'}
                >
                  <View style={styles.faqHeader}>
                    <Ionicons
                      name={expandedFAQ === item.id ? 'chevron-down' : 'chevron-forward'}
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.faqQuestion}>{item.question}</Text>
                  </View>

                  {expandedFAQ === item.id && (
                    <Text style={styles.faqAnswer}>{item.answer}</Text>
                  )}
                </TouchableOpacity>

                {index < faqItems.length - 1 && <View style={styles.faqDivider} />}
              </View>
            ))}
          </View>
        </View>

        {/* Legal & Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legalAndInfo') || 'Legal & Information'}</Text>

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
          <Text style={styles.infoText}>
            {t('responseTimeInfo') || 'Our support team typically responds within 24 hours.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
