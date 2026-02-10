import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>TruckinFox</Text>
        <Text style={styles.subtitle}>
          A modern cargo transportation platform built with React Native and Expo,
          connecting customers with reliable carriers across Norway.
        </Text>
        <View style={styles.ctaRow}>
          <Link href="/(auth)/login" style={[styles.cta, styles.ctaPrimary]}>Sign in</Link>
          <Link href="/(customer)/create-order" style={[styles.cta, styles.ctaSecondary]}>
            Create order
          </Link>
          <Link href="/(carrier)/marketplace" style={styles.ctaGhost}>Marketplace</Link>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>For customers</Text>
        <Text style={styles.item}>- Create cargo requests with detailed specifications</Text>
        <Text style={styles.item}>- Choose pricing models: fixed, negotiable, auction</Text>
        <Text style={styles.item}>- Browse and compare carrier bids</Text>
        <Text style={styles.item}>- Escrow payment simulation via Vipps</Text>
        <Text style={styles.item}>- Real-time GPS order tracking</Text>
        <Text style={styles.item}>- Direct messaging with carriers</Text>
        <Text style={styles.item}>- Rate and review carriers</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>For carriers</Text>
        <Text style={styles.item}>- Browse available cargo requests in marketplace</Text>
        <Text style={styles.item}>- Submit competitive bids</Text>
        <Text style={styles.item}>- Manage active orders</Text>
        <Text style={styles.item}>- Secure payment processing (10% platform fee)</Text>
        <Text style={styles.item}>- Build reputation through ratings</Text>
        <Text style={styles.item}>- Communicate directly with customers</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Platform features</Text>
        <Text style={styles.item}>- Multi-language support (Norwegian default, English)</Text>
        <Text style={styles.item}>- Automatic browser language detection</Text>
        <Text style={styles.item}>- Secure escrow payment flow</Text>
        <Text style={styles.item}>- Progressive Web App for Android and iOS</Text>
        <Text style={styles.item}>- User authentication with dual profiles</Text>
        <Text style={styles.item}>- Ratings and reviews</Text>
        <Text style={styles.item}>- Live GPS tracking with maps</Text>
        <Text style={styles.item}>- Real-time messaging with read receipts</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How it works</Text>
        <Text style={styles.item}>1. Customer creates a cargo request with details and dates.</Text>
        <Text style={styles.item}>2. Carriers submit bids and ask questions in chat.</Text>
        <Text style={styles.item}>3. Customer selects the best offer by price and rating.</Text>
        <Text style={styles.item}>4. Escrow payment is confirmed and order is locked.</Text>
        <Text style={styles.item}>5. Carrier transports cargo with GPS tracking active.</Text>
        <Text style={styles.item}>6. Delivery confirmed, payout released minus platform fee.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profiles</Text>
        <Text style={styles.item}>Customer profile: name, phone, city, order history, ratings.</Text>
        <Text style={styles.item}>
          Carrier profile: company name, organization number, specializations, verification badge,
          completed jobs, ratings, vehicle photos.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Install as app</Text>
        <Text style={styles.item}>Android: Chrome menu, then Install app or Add to Home screen.</Text>
        <Text style={styles.item}>iOS: Safari Share, then Add to Home Screen.</Text>
        <Text style={styles.item}>Desktop: Chrome/Edge install icon in the address bar.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tech stack</Text>
        <Text style={styles.item}>- React Native + TypeScript + Expo + Expo Router</Text>
        <Text style={styles.item}>- Firebase (Firestore, Auth, Storage)</Text>
        <Text style={styles.item}>- React Native Paper + Phosphor Icons</Text>
        <Text style={styles.item}>- i18next for localization</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick links</Text>
        <View style={styles.links}>
          <Link href="/(auth)/register" style={styles.link}>Register</Link>
          <Link href="/(customer)/browse-bids" style={styles.link}>Browse bids</Link>
          <Link href="/(customer)/track-order" style={styles.link}>Track order</Link>
          <Link href="/(shared)/messages" style={styles.link}>Messages</Link>
          <Link href="/(shared)/profile" style={styles.link}>Profile</Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: Colors.background,
  },
  container: {
    padding: 24,
    gap: 20,
  },
  hero: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cta: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    fontWeight: '600',
  },
  ctaPrimary: {
    backgroundColor: Colors.primary,
    color: Colors.card,
  },
  ctaSecondary: {
    backgroundColor: Colors.secondary,
    color: Colors.card,
  },
  ctaGhost: {
    color: Colors.primary,
    fontWeight: '600',
    paddingVertical: 10,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  item: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  links: {
    gap: 10,
  },
  link: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
  },
});
