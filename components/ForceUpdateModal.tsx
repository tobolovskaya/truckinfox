import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../lib/sharedStyles';

const APP_STORE_URL = 'https://apps.apple.com/app/truckinfox/id000000000';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.truckinfox.app';

interface ForceUpdateModalProps {
  visible: boolean;
}

export function ForceUpdateModal({ visible }: ForceUpdateModalProps) {
  const { t } = useTranslation();

  const handleUpdate = () => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🚛</Text>
          <Text style={styles.title}>{t('updateRequired')}</Text>
          <Text style={styles.message}>{t('updateRequiredMessage')}</Text>
          <TouchableOpacity style={styles.button} onPress={handleUpdate} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{t('updateNow')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl ?? 20,
    padding: spacing.xl,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl ?? 20,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl ?? 48,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
});
