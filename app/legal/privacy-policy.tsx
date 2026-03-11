import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';
import { ScreenHeader } from '../../components/ScreenHeader';

type Section = { heading: string; body: string };

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const sections: Section[] = t('privacyPolicyContent', { returnObjects: true }) as Section[];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('privacyPolicy')} onBackPress={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('privacyPolicy')}</Text>
          <Text style={styles.heroMeta}>{t('lastUpdated')}: {t('privacyPolicyDate')}</Text>
        </View>

        {Array.isArray(sections) &&
          sections.map((section, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('legalContactUs')}</Text>
          <Text style={styles.footerEmail}>support@truckinfox.no</Text>
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl ?? 48,
  },
  hero: {
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: fontSize.xxl ?? 24,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  heroMeta: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeading: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  footer: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  footerEmail: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
