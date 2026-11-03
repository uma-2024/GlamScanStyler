import React, { useCallback, useEffect, useState } from 'react';
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
import { API_BASE_URL_WITH_API } from '../config/api';
import { authenticatedFetch } from '../services/apiClient';

interface WalletScreenProps {
  userId?: string;
  onBack?: () => void;
}

interface WalletTxn {
  _id?: string;
  type?: 'credit' | 'debit';
  amount?: number;
  note?: string;
  source?: string;
  createdAt?: string;
}

const PRIMARY_COLOR = '#FD8B36';
const ICON_COLOR = PRIMARY_COLOR;
const BACKGROUND_COLOR = '#FFF3E8';
const PRIMARY_TEXT_COLOR = '#1F1F1F';
const SECONDARY_TEXT_COLOR = '#6E6E6E';
const MUTED_TEXT_COLOR = '#9E9E9E';
const ERROR_COLOR = '#D62828';
const DEBIT_COLOR = '#C1121F';

const WalletScreen: React.FC<WalletScreenProps> = ({ userId, onBack }) => {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchWalletData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setError('User not found');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [walletRes, txnRes] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL_WITH_API}/wallet/${userId}`),
        authenticatedFetch(`${API_BASE_URL_WITH_API}/wallet/${userId}/transactions`),
      ]);

      if (!walletRes.ok) {
        throw new Error('Failed to fetch wallet balance');
      }

      const walletJson = await walletRes.json();
      const walletBalance = Number(walletJson.balanceCached ?? walletJson.balance ?? 0) || 0;
      setBalance(walletBalance);

      if (txnRes.ok) {
        const txnJson = await txnRes.json();
        if (Array.isArray(txnJson)) {
          setTransactions(txnJson);
        } else {
          setTransactions([]);
        }
      } else {
        setTransactions([]);
      }
    } catch (e) {
      console.error('Wallet fetch error:', e);
      setError('Unable to load wallet right now');
      setBalance(0);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const formatAmount = (value?: number | null) =>
    `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (date?: string) => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Icon name="arrow-back" size={22} color={ICON_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Glam Wallet</Text>
        <TouchableOpacity onPress={fetchWalletData} style={styles.refreshButton} activeOpacity={0.7}>
          <Icon name="refresh" size={20} color={ICON_COLOR} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroLabel}>EXPERT WALLET</Text>
            <Icon name="account-balance-wallet" size={22} color={PRIMARY_COLOR} />
          </View>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>{formatAmount(balance)}</Text>
          <View style={styles.heroPill}>
            <Icon name="verified" size={14} color={PRIMARY_COLOR}  />
            <Text style={styles.heroPillText}>Secure Wallet</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.centerText}>Loading wallet...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Icon name="error-outline" size={28} color={ERROR_COLOR} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchWalletData} style={styles.retryBtn} activeOpacity={0.8}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <Text style={styles.sectionCount}>{transactions.length}</Text>
            </View>

            {transactions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon name="receipt-long" size={30} color={MUTED_TEXT_COLOR} />
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptySubtitle}>Credits and debits will appear here.</Text>
              </View>
            ) : (
              transactions.slice(0, 10).map((txn) => {
                const isCredit = txn.type === 'credit';
                const amount = Number(txn.amount || 0);

                return (
                  <View key={txn._id || `${txn.createdAt}-${amount}`} style={styles.txnCard}>
                    <View
                      style={[
                        styles.txnIconWrap,
                        isCredit ? styles.txnIconCreditBg : styles.txnIconDebitBg,
                      ]}>
                    <Icon
                      name={isCredit ? 'south-west' : 'north-east'}
                      size={18}
                      color={isCredit ? PRIMARY_COLOR : DEBIT_COLOR}
                    />
                    </View>
                    <View style={styles.txnInfo}>
                      <Text style={styles.txnTitle}>{txn.note || txn.source || 'Wallet transaction'}</Text>
                      <Text style={styles.txnDate}>{formatDate(txn.createdAt)}</Text>
                    </View>
                    <Text style={[styles.txnAmount, isCredit ? styles.creditText : styles.debitText]}>
                      {isCredit ? '+' : '-'}{formatAmount(amount)}
                    </Text>
                  </View>
                );
              })
            )}
          </>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: compactTopPadding(14),
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: PRIMARY_TEXT_COLOR,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: '#FFECE0',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.25)',
    // shadowColor: '#FF8A33',
    // shadowOpacity: 0.18,
    // shadowRadius: 12,
    // shadowOffset: { width: 0, height: 8 },
    // elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: PRIMARY_TEXT_COLOR,
    fontWeight: '600',
  },
  balanceLabel: {
    fontSize: 13,
    color: SECONDARY_TEXT_COLOR,
    marginBottom: 6,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '700',
    color: PRIMARY_TEXT_COLOR,
    marginBottom: 12,
  },
  heroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.5)',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  heroPillText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  centerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  centerText: {
    marginTop: 10,
    color: SECONDARY_TEXT_COLOR,
    fontSize: 14,
  },
  errorText: {
    marginTop: 10,
    marginBottom: 12,
    color: ERROR_COLOR,
    fontSize: 14,
  },
  retryBtn: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: PRIMARY_TEXT_COLOR,
  },
  sectionCount: {
    backgroundColor: '#FFF1EA',
    color: PRIMARY_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.3)',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_TEXT_COLOR,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: SECONDARY_TEXT_COLOR,
    marginTop: 4,
  },
  txnCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  txnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  txnIconCreditBg: {
    backgroundColor: 'rgba(255, 106, 0, 0.15)',
  },
  txnIconDebitBg: {
    backgroundColor: 'rgba(193, 18, 31, 0.15)',
  },
  txnInfo: {
    flex: 1,
  },
  txnTitle: {
    fontSize: 14,
    color: PRIMARY_TEXT_COLOR,
    fontWeight: '500',
  },
  txnDate: {
    fontSize: 12,
    color: SECONDARY_TEXT_COLOR,
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  creditText: {
    color: PRIMARY_COLOR,
  },
  debitText: {
    color: DEBIT_COLOR,
  },
});

export default WalletScreen;
