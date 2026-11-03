import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from '../components/AppLinearGradient';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { API_BASE_URL_WITH_API } from '../config/api';

interface AnalyticsScreenProps {
  userId?: string;
  onBack?: () => void;
}

interface AnalyticsResponse {
  stylistName: string;
  days: number;
  overview: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    pendingBookings: number;
    ongoingBookings: number;
    totalRevenue: number;
    averageBookingValue: number;
    completionRate: number;
    cancellationRate: number;
    repeatClients: number;
    totalReviews: number;
    averageRating: number;
    profileRating: number;
  };
  tracking: {
    profileViews: number;
    adImpressions: number;
    adClicks: number;
    whatsappClicks: number;
    callClicks: number;
    bookingIntents: number;
  };
  servicePerformance: Array<{
    serviceName: string;
    bookings: number;
    revenue: number;
  }>;
  monthlyPerformance: Array<{
    label: string;
    bookings: number;
    revenue: number;
  }>;
}

const PRIMARY_COLOR = '#FD8B36';
const BACKGROUND_COLOR = '#FFF3E8';
const CARD_COLOR = '#FFFFFF';
const TEXT_COLOR = '#2F241D';
const MUTED_TEXT = '#7A6758';
const PRIMARY_GRADIENT = ['#FD8B36', '#f7bb2c'];
const PRIMARY_GRADIENT_LOCATIONS = [0, 0.7];
const PRIMARY_GRADIENT_START = { x: 0.5, y: 0.5 };
const PRIMARY_GRADIENT_END = { x: 0.5, y: 0 };
const PERIODS = [7, 30, 90];

const STATUS_COLORS = ['#FD8B36', '#F7BB2C', '#E58D5B', '#8C6A53'];

const DonutChart: React.FC<{
  data: Array<{ label: string; value: number; color: string }>;
  centerLabel: string;
  centerValue: string;
}> = ({ data, centerLabel, centerValue }) => {
  const size = 176;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(data.reduce((sum, item) => sum + item.value, 0), 1);
  let cumulative = 0;

  return (
    <View style={styles.donutWrap}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {data.map((item) => {
            const fraction = item.value / total;
            const strokeDasharray = `${circumference * fraction} ${circumference}`;
            const strokeDashoffset = -circumference * cumulative;
            cumulative += fraction;

            return (
              <Circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={item.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            );
          })}
        </G>
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutCenterValue}>{centerValue}</Text>
        <Text style={styles.donutCenterLabel}>{centerLabel}</Text>
      </View>
    </View>
  );
};

const VerticalBarChart: React.FC<{
  data: Array<{ label: string; primary: number; secondary: number }>;
  primaryColor?: string;
  secondaryColor?: string;
}> = ({ data, primaryColor = PRIMARY_COLOR, secondaryColor = '#F7BB2C' }) => {
  const chartHeight = 160;
  const baseY = 130;
  const maxValue = Math.max(
    ...data.flatMap((item) => [item.primary, item.secondary]),
    1
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={Math.max(data.length * 52 + 24, 280)} height={chartHeight}>
        {data.map((item, index) => {
          const x = 20 + index * 52;
          const primaryHeight = Math.max((item.primary / maxValue) * 92, item.primary > 0 ? 8 : 0);
          const secondaryHeight = Math.max((item.secondary / maxValue) * 92, item.secondary > 0 ? 8 : 0);

          return (
            <G key={item.label}>
              <Rect
                x={x}
                y={baseY - primaryHeight}
                width={16}
                height={primaryHeight}
                rx={8}
                fill={primaryColor}
              />
              <Rect
                x={x + 20}
                y={baseY - secondaryHeight}
                width={16}
                height={secondaryHeight}
                rx={8}
                fill={secondaryColor}
              />
              <SvgText
                x={x + 18}
                y={150}
                fontSize="11"
                fontWeight="700"
                fill={MUTED_TEXT}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
};

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ userId, onBack }) => {
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!userId) {
      setError('User not found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL_WITH_API}/stylist/analytics/${userId}?days=${selectedDays}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `Failed to fetch analytics (${response.status})`);
      }

      setAnalytics(result.data);
    } catch (fetchError) {
      console.error('❌ Error fetching stylist analytics:', fetchError);
      setAnalytics(null);
      setError('Unable to load analytics right now');
    } finally {
      setLoading(false);
    }
  }, [selectedDays, userId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatAmount = (amount: number) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  const overviewCards = useMemo(() => {
    if (!analytics) {
      return [];
    }

    return [
      { label: 'Bookings', value: analytics.overview.totalBookings.toString(), icon: 'event-note' },
      { label: 'Revenue', value: formatAmount(analytics.overview.totalRevenue), icon: 'payments' },
      { label: 'Completion', value: `${analytics.overview.completionRate}%`, icon: 'task-alt' },
      { label: 'Avg Booking', value: formatAmount(analytics.overview.averageBookingValue), icon: 'insights' },
    ];
  }, [analytics]);

  const funnelCards = useMemo(() => {
    if (!analytics) {
      return [];
    }

    return [
      { label: 'Profile Views', value: analytics.tracking.profileViews },
      { label: 'Ad Impressions', value: analytics.tracking.adImpressions },
      { label: 'Ad Clicks', value: analytics.tracking.adClicks },
      { label: 'Booking Intents', value: analytics.tracking.bookingIntents },
      { label: 'Completed Jobs', value: analytics.overview.completedBookings },
    ];
  }, [analytics]);

  const maxMonthlyRevenue = useMemo(() => {
    if (!analytics?.monthlyPerformance?.length) {
      return 1;
    }

    return Math.max(...analytics.monthlyPerformance.map((item) => item.revenue), 1);
  }, [analytics]);

  const bookingMix = useMemo(() => {
    if (!analytics) {
      return [];
    }

    return [
      { label: 'Completed', value: analytics.overview.completedBookings, color: STATUS_COLORS[0] },
      { label: 'Cancelled', value: analytics.overview.cancelledBookings, color: STATUS_COLORS[1] },
      { label: 'Pending', value: analytics.overview.pendingBookings, color: STATUS_COLORS[2] },
      { label: 'Ongoing', value: analytics.overview.ongoingBookings, color: STATUS_COLORS[3] },
    ];
  }, [analytics]);

  const maxFunnelValue = useMemo(() => {
    if (!funnelCards.length) {
      return 1;
    }

    return Math.max(...funnelCards.map((item) => item.value), 1);
  }, [funnelCards]);

  const maxServiceBookings = useMemo(() => {
    if (!analytics?.servicePerformance?.length) {
      return 1;
    }

    return Math.max(...analytics.servicePerformance.map((item) => item.bookings), 1);
  }, [analytics]);

  const chartPerformanceData = useMemo(() => {
    if (!analytics?.monthlyPerformance?.length) {
      return [];
    }

    return analytics.monthlyPerformance.map((item) => ({
      label: item.label,
      primary: item.revenue,
      secondary: item.bookings,
    }));
  }, [analytics]);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn} activeOpacity={0.7}>
          <Icon name="arrow-back" size={22} color={PRIMARY_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <TouchableOpacity onPress={fetchAnalytics} style={styles.iconBtn} activeOpacity={0.7}>
          <Icon name="refresh" size={20} color={PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#FFF6EF', '#FFE5D1', '#FFD7B6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>EXPERT PERFORMANCE</Text>
          <Text style={styles.heroTitle}>{analytics?.stylistName || 'Your analytics dashboard'}</Text>
          <Text style={styles.heroSubtitle}>
            Track bookings, revenue, repeat clients, and visibility signals in one place.
          </Text>
          <View style={styles.periodRow}>
            {PERIODS.map((days) => {
              const selected = days === selectedDays;
              return (
                <TouchableOpacity
                  key={days}
                  style={[styles.periodChip, selected && styles.periodChipSelected]}
                  onPress={() => setSelectedDays(days)}
                  activeOpacity={0.8}>
                  <Text style={[styles.periodChipText, selected && styles.periodChipTextSelected]}>
                    {days}D
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.centerText}>Loading analytics...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Icon name="error-outline" size={30} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : analytics ? (
          <>
            <View style={styles.cardGrid}>
              {overviewCards.map((card) => (
                <View key={card.label} style={styles.metricCard}>
                  <View style={styles.metricIconWrap}>
                    <Icon name={card.icon} size={18} color={PRIMARY_COLOR} />
                  </View>
                  <Text style={styles.metricValue}>{card.value}</Text>
                  <Text style={styles.metricLabel}>{card.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Completed bookings</Text>
                <Text style={styles.summaryValue}>{analytics.overview.completedBookings}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cancelled bookings</Text>
                <Text style={styles.summaryValue}>{analytics.overview.cancelledBookings}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pending and confirmed</Text>
                <Text style={styles.summaryValue}>{analytics.overview.pendingBookings}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ongoing bookings</Text>
                <Text style={styles.summaryValue}>{analytics.overview.ongoingBookings}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Repeat clients</Text>
                <Text style={styles.summaryValue}>{analytics.overview.repeatClients}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Average rating</Text>
                <Text style={styles.summaryValue}>{analytics.overview.averageRating}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Booking Mix</Text>
              <Text style={styles.sectionSubtitle}>
                A quick view of how your bookings are split across statuses.
              </Text>
              <View style={styles.bookingMixLayout}>
                <DonutChart
                  data={bookingMix}
                  centerValue={analytics.overview.totalBookings.toString()}
                  centerLabel="Total bookings"
                />
                <View style={styles.bookingMixLegend}>
                  {bookingMix.map((item) => (
                    <View key={item.label} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendLabel}>{item.label}</Text>
                      <Text style={styles.legendValue}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Visibility Funnel</Text>
              <Text style={styles.sectionSubtitle}>
                These numbers come from tracked events. They grow as you send tracking events from profile opens, ads, and contact taps.
              </Text>
              {funnelCards.map((item) => (
                <View key={item.label} style={styles.funnelRow}>
                  <View style={styles.funnelHeader}>
                    <Text style={styles.summaryLabel}>{item.label}</Text>
                    <Text style={styles.summaryValue}>{item.value}</Text>
                  </View>
                  <View style={styles.funnelTrack}>
                    <View
                      style={[
                        styles.funnelFill,
                        { width: `${Math.max((item.value / maxFunnelValue) * 100, item.value > 0 ? 8 : 0)}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Top Services</Text>
              {analytics.servicePerformance.length > 0 ? (
                analytics.servicePerformance.map((service) => (
                  <View key={service.serviceName} style={styles.serviceRow}>
                    <View style={styles.serviceIconWrap}>
                      <Icon name="content-cut" size={16} color={PRIMARY_COLOR} />
                    </View>
                    <View style={styles.serviceContent}>
                      <Text style={styles.serviceName}>{service.serviceName}</Text>
                      <Text style={styles.serviceMeta}>
                        {service.bookings} bookings • {formatAmount(service.revenue)}
                      </Text>
                      <View style={styles.serviceBarTrack}>
                        <View
                          style={[
                            styles.serviceBarFill,
                            {
                              width: `${Math.max((service.bookings / maxServiceBookings) * 100, service.bookings > 0 ? 10 : 0)}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No completed bookings yet for service-wise analytics.</Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>6-Month Performance</Text>
              <Text style={styles.sectionSubtitle}>
                Orange bars show revenue and gold bars show bookings across recent months.
              </Text>
              <VerticalBarChart data={chartPerformanceData} />
              {analytics.monthlyPerformance.map((month) => {
                const widthPercent = `${Math.max((month.revenue / maxMonthlyRevenue) * 100, month.revenue > 0 ? 12 : 0)}%`;
                return (
                  <View key={month.label} style={styles.trendRow}>
                    <View style={styles.trendHeader}>
                      <Text style={styles.trendLabel}>{month.label}</Text>
                      <Text style={styles.trendValue}>
                        {formatAmount(month.revenue)} • {month.bookings} bookings
                      </Text>
                    </View>
                    <View style={styles.trendTrack}>
                      <View style={[styles.trendFill, { width: widthPercent as any }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
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
    paddingHorizontal: 18,
    paddingTop: compactTopPadding(16),
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(253, 139, 54, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_COLOR,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: MUTED_TEXT,
    marginTop: 8,
  },
  periodRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.8)',
    marginRight: 10,
  },
  periodChipSelected: {
    backgroundColor: PRIMARY_COLOR,
  },
  periodChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  periodChipTextSelected: {
    color: '#fff',
  },
  centerBox: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    marginTop: 12,
    color: MUTED_TEXT,
    fontSize: 14,
  },
  errorText: {
    marginTop: 10,
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48.2%',
    backgroundColor: CARD_COLOR,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#FFF0E4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_COLOR,
  },
  metricLabel: {
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: CARD_COLOR,
    borderRadius: 20,
    padding: 18,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: MUTED_TEXT,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5E3D3',
  },
  summaryLabel: {
    flex: 1,
    fontSize: 14,
    color: MUTED_TEXT,
    marginRight: 16,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  bookingMixLayout: {
    marginTop: 6,
    alignItems: 'center',
  },
  donutWrap: {
    width: 176,
    height: 176,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutCenterValue: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_COLOR,
  },
  donutCenterLabel: {
    marginTop: 2,
    fontSize: 12,
    color: MUTED_TEXT,
    fontWeight: '600',
  },
  bookingMixLegend: {
    width: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5E3D3',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    color: MUTED_TEXT,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  funnelRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5E3D3',
  },
  funnelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  funnelTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#F6E7DA',
    borderRadius: 999,
    overflow: 'hidden',
  },
  funnelFill: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 999,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5E3D3',
  },
  serviceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#FFF0E4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceContent: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  serviceMeta: {
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 4,
  },
  serviceBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F5E3D3',
    overflow: 'hidden',
    marginTop: 10,
  },
  serviceBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: PRIMARY_COLOR,
  },
  trendRow: {
    marginBottom: 14,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  trendValue: {
    fontSize: 12,
    color: MUTED_TEXT,
  },
  trendTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#F5E3D3',
    overflow: 'hidden',
  },
  trendFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: PRIMARY_COLOR,
  },
  emptyText: {
    color: MUTED_TEXT,
    fontSize: 14,
  },
});

export default AnalyticsScreen;
