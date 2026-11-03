import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';
import { compactTopPadding } from '../utils/responsiveLayout';
import { toCloudFrontUrl } from '../utils/cdnUrl';

interface SpecialServiceScreenProps {
  userId?: string;
  onBack?: () => void;
}

interface ServiceDetail {
  _id?: string;
  serviceId?: string;
  serviceName?: string;
  amount?: number;
  serviceType?: string | string[];
  gender?: string | string[];
  images?: Record<string, string>;
  createdAt?: string;
}

const PRIMARY_COLOR = '#FD8B36';
const BACKGROUND_COLOR = '#FFF3E8';
const TEXT_COLOR = '#1F1F1F';
const MUTED_TEXT_COLOR = '#666';

const normalizeList = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
};

const formatList = (value?: string | string[]) => {
  const list = normalizeList(value);
  return list.length > 0 ? list.join(', ') : 'Not added';
};

const formatAmount = (value?: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;

const getServiceImage = (service: ServiceDetail) => {
  const imageUrl = Object.values(service.images || {}).find(Boolean);
  return imageUrl ? toCloudFrontUrl(imageUrl) : null;
};

const SpecialServiceScreen: React.FC<SpecialServiceScreenProps> = ({
  userId,
  onBack,
}) => {
  const [services, setServices] = useState<ServiceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSpecialServices = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setError('User not found');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [specialRes, profileRes] = await Promise.all([
        fetch(`${API_BASE_URL_WITH_API}/services/special/${userId}`),
        fetch(`${API_BASE_URL_WITH_API}/profile/${userId}`),
      ]);

      if (!specialRes.ok) {
        throw new Error('Failed to fetch special services');
      }

      const specialJson = await specialRes.json();
      const specialList: ServiceDetail[] = Array.isArray(specialJson?.data)
        ? specialJson.data
        : [];

      let selectedServices: ServiceDetail[] = [];
      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        selectedServices = Array.isArray(profileJson?.data?.selectedServices)
          ? profileJson.data.selectedServices
          : [];
      }

      const selectedServiceMap = new Map(
        selectedServices.map((service) => [service.serviceId, service]),
      );

      const mergedServices = specialList.map((specialService) => {
        const matchedService = selectedServiceMap.get(specialService.serviceId);
        return {
          ...matchedService,
          ...specialService,
          serviceName:
            matchedService?.serviceName || specialService.serviceName || 'Special Service',
          amount: matchedService?.amount,
          serviceType: matchedService?.serviceType,
          gender: matchedService?.gender,
          images: matchedService?.images,
        };
      });

      setServices(mergedServices);
    } catch (fetchError) {
      console.error('Special service fetch error:', fetchError);
      setError('Unable to load special services right now');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSpecialServices();
  }, [fetchSpecialServices]);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Specialization</Text>
        <TouchableOpacity
          onPress={fetchSpecialServices}
          style={styles.refreshButton}
          activeOpacity={0.7}>
          <Icon name="refresh" size={20} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Icon name="error-outline" size={30} color="#D32F2F" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchSpecialServices}
            activeOpacity={0.8}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : services.length === 0 ? (
        <View style={styles.centerBox}>
          <View style={styles.emptyIconWrap}>
            <Icon name="stars" size={36} color={PRIMARY_COLOR} />
          </View>
          <Text style={styles.emptyTitle}>No special services yet</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.summaryPill}>
            <Icon name="stars" size={15} color="#A54500" />
            <Text style={styles.summaryText}>
              {services.length} special {services.length === 1 ? 'service' : 'services'}
            </Text>
          </View>

          {services.map((service, index) => {
            const imageUri = getServiceImage(service);
            const key = service.serviceId || service._id || `${service.serviceName}-${index}`;

            return (
              <View key={key} style={styles.serviceCard}>
                <View style={styles.badge}>
                  <Icon name="stars" size={13} color="#A54500" />
                  <Text style={styles.badgeText}>Special</Text>
                </View>
                <View style={styles.serviceHeader}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.serviceImage} />
                  ) : (
                    <View style={styles.serviceImageFallback}>
                      <Icon name="spa" size={26} color={PRIMARY_COLOR} />
                    </View>
                  )}
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.serviceName}</Text>
                    <View style={styles.pricePill}>
                      <Icon name="currency-rupee" size={13} color={PRIMARY_COLOR} />
                      <Text style={styles.priceText}>{formatAmount(service.amount)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailChip}>
                    <Icon name="room-service" size={15} color={MUTED_TEXT_COLOR} />
                    <Text style={styles.detailText}>{formatList(service.serviceType)}</Text>
                  </View>
                  <View style={styles.detailChip}>
                    <Icon name="person" size={15} color={MUTED_TEXT_COLOR} />
                    <Text style={styles.detailText}>{formatList(service.gender)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    paddingTop: compactTopPadding(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E1D6',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF8F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: PRIMARY_COLOR,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    color: MUTED_TEXT_COLOR,
    fontWeight: '600',
  },
  summaryPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFE7D5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  summaryText: {
    fontSize: 13,
    color: '#A54500',
    fontWeight: '700',
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0E0D6',
    shadowColor: '#D96A3A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFE7D5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A54500',
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 82,
  },
  serviceImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFE5CC',
  },
  serviceImageFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFE5CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  pricePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF6EF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  priceText: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3EAE3',
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8F4F1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailText: {
    fontSize: 12,
    color: MUTED_TEXT_COLOR,
    fontWeight: '600',
  },
});

export default SpecialServiceScreen;
