import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getLoginSession } from '../utils/authStorage';
import { API_BASE_URL_WITH_API } from '../config/api';

const FILTER_OPTIONS = ['All', 'Online', 'Cash', 'This Week', 'This Month'];

const PaymentsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const session = await getLoginSession();
      const userId = session?.userId;
      const token = session?.loginId;
      if (!userId || !token) throw new Error('User not found or not authenticated');
      
      const response = await fetch(`${API_BASE_URL_WITH_API}/stylist/bookings/${userId}?status=completed,cancelled&limit=50`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payments history');
      }

      const result = await response.json();
      
      if (result.success && result.data && result.data.bookings) {
        // Filter out cancelled bookings unless they have a payment
        const validPayments = result.data.bookings.filter((b: any) => 
          b.status === 'completed' || (b.status === 'cancelled' && b.isPaymentCompleted)
        );
        
        // Sort by date (most recent first)
        validPayments.sort((a: any, b: any) => {
          const dateA = new Date(a.date || a.createdAt).getTime();
          const dateB = new Date(b.date || b.createdAt).getTime();
          return dateB - dateA;
        });
        
        setPayments(validPayments);
      } else {
        setPayments([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payments history');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredPayments = () => {
    if (activeFilter === 'All') return payments;
    return payments.filter(p => {
      if (activeFilter === 'Online' || activeFilter === 'Cash') {
        const paymentMethod = p.paymentMethod || (p.isPaymentCompleted ? 'Online' : 'Cash');
        const isCash = paymentMethod.toLowerCase().includes('cash') || paymentMethod.toLowerCase().includes('direct');
        if (activeFilter === 'Online') return !isCash;
        if (activeFilter === 'Cash') return isCash;
      }
      
      if (activeFilter === 'This Week' || activeFilter === 'This Month') {
        const paymentDate = new Date(p.date || p.createdAt);
        const now = new Date();
        
        if (activeFilter === 'This Week') {
          const diffTime = now.getTime() - paymentDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          return diffDays >= 0 && diffDays <= 7;
        }
        
        if (activeFilter === 'This Month') {
          return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
        }
      }
      
      return true;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'paid':
        return '#4CAF50';
      case 'pending':
        return '#FFC107';
      case 'failed':
      case 'cancelled':
        return '#F44336';
      default:
        return '#757575';
    }
  };
  
  const getStatusBgColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'paid':
        return '#E8F5E9'; 
      case 'pending':
        return '#FFF8E1'; 
      case 'failed':
      case 'cancelled':
        return '#FFEBEE'; 
      default:
        return '#F5F5F5'; 
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-GB', options);
  };

  const renderPaymentItem = ({ item }: { item: any }) => {
    const isCancelled = item.status === 'cancelled';
    const paymentMethod = item.paymentMethod || (item.isPaymentCompleted ? 'Online' : 'Cash');
    const isCash = paymentMethod.toLowerCase().includes('cash') || paymentMethod.toLowerCase().includes('direct');
    const statusColor = getStatusColor(item.paymentStatus || item.status);
    const statusBgColor = getStatusBgColor(item.paymentStatus || item.status);
    
    return (
      <View style={styles.payoutCard}>
        <View style={styles.cardHeader}>
          <Text 
            style={styles.bookingIdText} 
            numberOfLines={1} 
            ellipsizeMode="middle"
          >
            ID: {item.bookingId}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{(item.paymentStatus || item.status).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.leftSection}>
            <Text style={styles.serviceName}>{item.serviceName}</Text>
            <Text style={styles.customerName}>{item.userName || 'Customer'}</Text>
            
            <View style={styles.paymentMethodWrapper}>
              <View style={[styles.iconCircle, isCash ? styles.cashIconBg : styles.onlineIconBg]}>
                <Icon name={isCash ? "payments" : "credit-card"} size={14} color={isCash ? "#4CAF50" : "#2196F3"} />
              </View>
              <Text style={styles.paymentMethodText}>{paymentMethod}</Text>
            </View>
          </View>

          <View style={styles.rightSection}>
            <Text style={styles.amountValue}>₹{item.price}</Text>
            <View style={styles.dateContainer}>
              <Icon name="calendar-today" size={12} color="#888" />
              <Text style={styles.dateValue}>
                {formatDate(item.date || item.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        {isCancelled && item.reason && (
          <View style={styles.failureReasonContainer}>
            <Icon name="info-outline" size={16} color="#F44336" />
            <Text style={styles.failureReasonText}>Cancelled: {item.reason}</Text>
          </View>
        )}
      </View>
    );
  };

  const filteredData = getFilteredPayments();

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments History</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterContainerWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterContainer} 
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_OPTIONS.map(opt => (
            <TouchableOpacity 
              key={opt} 
              onPress={() => setActiveFilter(opt)}
              style={[styles.filterChip, activeFilter === opt && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, activeFilter === opt && styles.filterTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FD8B36" />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadPayments}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredData.length === 0 ? (
          <View style={styles.centerContainer}>
            <Icon name="account-balance-wallet" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No {activeFilter !== 'All' ? activeFilter.toLowerCase() : 'service'} payments history found.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.bookingId || item._id}
            renderItem={renderPaymentItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  header: {
    flexDirection: 'row',
    paddingTop: compactTopPadding(40),
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF3E8',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#000',
  },
  contentContainer: {
    flex: 1,
  },
  filterContainerWrapper: {
    backgroundColor: '#FFF3E8',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterContainer: {
    flexGrow: 0,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#FD8B36',
  },
  filterText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 13,
  },
  filterTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  payoutCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 12,
  },
  bookingIdText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flexShrink: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
    paddingRight: 12,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  paymentMethodWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  cashIconBg: {
    backgroundColor: '#E8F5E9',
  },
  onlineIconBg: {
    backgroundColor: '#E3F2FD',
  },
  paymentMethodText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 6,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateValue: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    marginLeft: 4,
  },
  failureReasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  failureReasonText: {
    color: '#F44336',
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FD8B36',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
});

export default PaymentsScreen;
