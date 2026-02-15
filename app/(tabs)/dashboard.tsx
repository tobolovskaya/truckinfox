import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { theme } from '../../theme/theme';

interface CargoRequest {
  id: string;
  title: string;
  cargo_type: string;
  weight: number;
  from_address: string;
  to_address: string;
  price: number;
  price_type: string;
  pickup_date: string;
  created_at: string;
  user_id: string;
  user_name: string;
  user_type: string;
  user_rating: number;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<CargoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, [user?.uid]);

  const fetchRequests = async () => {
    try {
      const q = query(
        collection(db, 'cargo_requests'),
        where('status', '==', 'active'),
        orderBy('created_at', 'desc'),
        limit(10)
      );

      const querySnapshot = await getDocs(q);
      const requestsData = await Promise.all(
        querySnapshot.docs.map(async docSnap => {
          const data = docSnap.data();

          // Fetch user data
          let userData = {
            full_name: 'Unknown User',
            user_type: 'personal',
            rating: 0,
          };

          if (data.user_id) {
            try {
              const userDoc = await getDoc(doc(db, 'users', data.user_id));
              if (userDoc.exists()) {
                const user = userDoc.data();
                userData = {
                  full_name: user.full_name || 'Unknown User',
                  user_type: user.user_type || 'personal',
                  rating: user.rating || 0,
                };
              }
            } catch (err) {
              console.error('Error fetching user:', err);
            }
          }

          return {
            id: docSnap.id,
            ...data,
            user_name: userData.full_name,
            user_type: userData.user_type,
            user_rating: userData.rating,
          } as CargoRequest;
        })
      );

      setRequests(requestsData);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchProfile();
    }
    fetchRequests();
  }, [user?.uid, fetchProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    if (user?.uid) {
      fetchProfile();
    }
    fetchRequests();
  };

  const formatPrice = (price: number, priceType: string) => {
    if (priceType === 'negotiable') return t('negotiable');
    if (priceType === 'auction') return t('auction');
    return `${price} NOK`;
  };

  const handleRequestPress = (request: CargoRequest) => {
    if (!request?.id) {
      console.error('Cannot navigate: Invalid request ID', request);
      return;
    }
    router.push(`/request-details/${request.id}` as any);
  };

  const getCargoTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      furniture: 'bed-outline',
      electronics: 'phone-portrait-outline',
      construction: 'construct-outline',
      automotive: 'car-outline',
      boats: 'boat-outline',
      campingvogn: 'home-outline',
      machinery: 'build-outline',
      other: 'cube-outline',
    };
    return icons[type] || 'cube-outline';
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View>
            <Text style={styles.greeting}>
              {t('hello')},{' '}
              {userProfile?.full_name || user?.displayName || user?.email?.split('@')[0] || 'User'}!
            </Text>
            <Text style={styles.subtitle}>{t('findBestDeals')}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color={theme.iconColors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="cube-outline" size={24} color={theme.iconColors.primary} />
            <Text style={styles.statNumber}>156</Text>
            <Text style={styles.statLabel}>{t('activeRequests')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="car-outline" size={24} color={theme.iconColors.success} />
            <Text style={styles.statNumber}>89</Text>
            <Text style={styles.statLabel}>{t('carriers')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color={theme.iconColors.info} />
            <Text style={styles.statNumber}>1.2k</Text>
            <Text style={styles.statLabel}>{t('completed')}</Text>
          </View>
        </View>

        {/* Recent Requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('recentRequests')}</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>{t('seeAll')}</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>{t('loading')}</Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {requests.map(request => (
                <TouchableOpacity
                  key={request.id}
                  style={styles.requestCard}
                  onPress={() => handleRequestPress(request)}
                >
                  <View style={styles.requestHeader}>
                    <View style={styles.requestInfo}>
                      <View style={styles.cargoTypeContainer}>
                        <Ionicons
                          name={getCargoTypeIcon(request.cargo_type) as any}
                          size={20}
                          color={theme.iconColors.primary}
                        />
                        <Text style={styles.cargoType}>{t(request.cargo_type)}</Text>
                      </View>
                      <Text style={styles.requestTitle}>{request.title}</Text>
                    </View>
                    <View style={styles.priceContainer}>
                      <Text style={styles.price}>
                        {formatPrice(request.price, request.price_type)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.routeContainer}>
                    <View style={styles.routePoint}>
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color={theme.iconColors.success}
                      />
                      <Text style={styles.routeText} numberOfLines={1}>
                        {request.from_address}
                      </Text>
                    </View>
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={theme.iconColors.gray.primary}
                    />
                    <View style={styles.routePoint}>
                      <Ionicons name="location-outline" size={16} color={theme.iconColors.error} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        {request.to_address}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requestFooter}>
                    <View style={styles.userInfo}>
                      <Ionicons
                        name={
                          request.user_type === 'business' ? 'business-outline' : 'person-outline'
                        }
                        size={16}
                        color={theme.iconColors.gray.primary}
                      />
                      <Text style={styles.userName}>{request.user_name}</Text>
                      <View style={styles.rating}>
                        <Ionicons name="star" size={14} color={theme.iconColors.rating} />
                        <Text style={styles.ratingText}>{request.user_rating}</Text>
                      </View>
                    </View>
                    <Text style={styles.weight}>{request.weight} kg</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'white',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
  },
  subtitle: {
    fontSize: 14,
    color: '#616161',
    marginTop: 2,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#616161',
    marginTop: 2,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  seeAll: {
    fontSize: 13,
    color: '#FF7043',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#616161',
  },
  requestsList: {
    gap: 10,
  },
  requestCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  requestInfo: {
    flex: 1,
  },
  cargoTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  cargoType: {
    fontSize: 11,
    color: '#FF7043',
    fontWeight: '600',
    marginLeft: 3,
    textTransform: 'uppercase',
  },
  requestTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#10B981',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  routePoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeText: {
    fontSize: 13,
    color: '#616161',
    marginLeft: 3,
    flex: 1,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userName: {
    fontSize: 13,
    color: '#616161',
    marginLeft: 3,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  ratingText: {
    fontSize: 11,
    color: '#616161',
    marginLeft: 1,
  },
  weight: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
  },
});
