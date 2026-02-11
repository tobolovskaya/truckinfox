import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Searchbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { CargoRequestCard } from '../../components/home/CargoRequestCard';
import { colors, spacing } from '../../theme';

export default function MarketplaceScreen() {
  const { userProfile } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data - in production, this would come from Firestore
  const mockRequests = [
    {
      id: '1',
      pickup: 'Oslo, Norway',
      delivery: 'Bergen, Norway',
      cargoType: 'Furniture',
      weight: 500,
      pickupDate: new Date('2024-03-15'),
      status: 'open',
      bidCount: 3,
    },
    {
      id: '2',
      pickup: 'Trondheim, Norway',
      delivery: 'Stavanger, Norway',
      cargoType: 'Electronics',
      weight: 150,
      pickupDate: new Date('2024-03-18'),
      status: 'open',
      bidCount: 5,
    },
  ];

  const handleRequestPress = (id: string) => {
    router.push(`/request-details/${id}`);
  };

  const renderItem = ({ item }: any) => (
    <CargoRequestCard {...item} onPress={() => handleRequestPress(item.id)} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={t('common.search')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </View>

      <FlatList
        data={mockRequests}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {userProfile?.role === 'customer'
                ? 'You have no cargo requests yet'
                : 'No cargo requests available'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  searchContainer: {
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  searchbar: {
    backgroundColor: colors.surface,
  },
  list: {
    paddingVertical: spacing.sm,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
