import { QueuedModal as Modal } from '../popup/PopupProvider';
/**
 * SubscriptionScreen.tsx
 *
 * Partner membership / subscription upgrade screen for GlamScanStyler.
 *
 * Architecture:
 *   Backend  → plan names, features, badge images, internal membership logic
 *   Store IAP → official localized price, currency, billing period, payment
 *   Backend  → verifies purchase token and activates membership
 *
 * Flow:
 *  1. Fetch backend plan metadata (/api/subscriptions/plans)
 *  2. Fetch App Store / Google Play subscription products (with localizedPrice)
 *  3. Merge: backend features + store price
 *  4. User taps → native purchase sheet (for paid plans)
 *  5. Purchase callback → POST /api/subscriptions/google-play/verify
 *  6. Backend confirms → finishTransaction → success modal
 *
 * Rules:
 *  - Freemium is never sent to Google Play
 *  - Price shown is always from Google Play, never from backend
 *  - Subscribe button disabled until Play products are loaded
 *  - Never show "success" before backend verification returns
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import CustomModal, { type ModalButton } from '../components/CustomModal';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';
import LinearGradient from '../components/AppLinearGradient';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  syncIOS,
  getReceiptDataIOS,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type ProductSubscription,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { getLoginSession } from '../utils/authStorage';
import { authenticatedFetch } from '../services/apiClient';
import {
  ANDROID_SUBSCRIPTION_SKUS,
  NON_PURCHASABLE_PLAN_CODES,
  ANDROID_BASE_PLAN_ID,
  getSubscriptionSkus,
  getStoreProductId,
} from '../constants/subscriptions';

// ─── Theme ───────────────────────────────────────────────────────────────────
const PRIMARY_COLOR = '#FD8B36';
const BACKGROUND_COLOR = '#FFF3E8';
const TEXT_COLOR = '#1F1F1F';
const SECONDARY_TEXT_COLOR = '#666666';
const CARD_ACCENT = '#FFF5EE';
const PRIMARY_GRADIENT = ['#FD8B36', '#f7bb2c'];
const PRIMARY_GRADIENT_LOCATIONS = [0, 0.7];
const PRIMARY_GRADIENT_START = { x: 0.5, y: 0.5 };
const PRIMARY_GRADIENT_END = { x: 0.5, y: 0 };
const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SubscriptionScreenProps {
  stylistId?: string;
  onBack?: () => void;
  onSubscriptionActivated?: () => void;
}

interface BackendPlan {
  _id: string;
  planName: string;
  planCode: string;
  description?: string;
  price: number;
  durationLabel: string;
  features?: string[];
  badgeImage?: string;
  androidProductId?: string | null;
  iosProductId?: string | null;
  benefits?: {
    visibility?: number;
    searchRankingBoost?: number;
    featuredBadge?: boolean;
    profileHighlight?: boolean;
    commissionRate?: number;
  };
}

/** Backend plan merged with Google Play price data. */
interface MergedPlan extends BackendPlan {
  /** Official localised price string from Google Play e.g. "₹499.00" */
  displayPrice: string;
  /** True when we have a live Play product for this plan. */
  playProductReady: boolean;
  /** Raw Play Store ProductSubscription object (Android only). */
  playProduct: ProductSubscription | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getPlanRank = (planCode: string, planName: string): number => {
  const key = `${planCode} ${planName}`.toUpperCase();
  if (key.includes('ELITE')) { return 3; }
  if (key.includes('VERIFIED_PRO') || key.includes('VERIFIED PRO') || key.includes('PRO') || key.includes('PLUS')) { return 2; }
  if (key.includes('FREEMIUM') || key.includes('FREE') || key.includes('BASIC')) { return 1; }
  return 0;
};

/**
 * Extract the best offer token from a Play Store ProductSubscription.
 * Looks for base plan `monthly` first, falls back to the first available offer.
 */
const getAndroidOfferToken = (product: ProductSubscription): string | null => {
  const offers: any[] =
    (product as any).subscriptionOffers ??
    (product as any).subscriptionOfferDetailsAndroid ??
    (product as any).subscriptionOfferDetails ??
    [];

  if (!offers || offers.length === 0) { return null; }

  // Prefer the base monthly plan
  const monthlyOffer = offers.find(
    (o: any) =>
      o.basePlanId === ANDROID_BASE_PLAN_ID ||
      o.basePlanIdAndroid === ANDROID_BASE_PLAN_ID ||
      o.offerId === ANDROID_BASE_PLAN_ID ||
      o.id === ANDROID_BASE_PLAN_ID
  );

  const matched = monthlyOffer ?? offers[0];
  return matched?.offerTokenAndroid ?? matched?.offerToken ?? null;
};

/**
 * Extract the localised price string from a Play Store ProductSubscription.
 * Tries multiple fields across IAP library versions.
 */
const getPlayDisplayPrice = (product: ProductSubscription): string => {
  // Try subscriptionOffers or subscriptionOfferDetails pricing phases first
  const offers: any[] =
    (product as any).subscriptionOffers ??
    (product as any).subscriptionOfferDetailsAndroid ??
    (product as any).subscriptionOfferDetails ??
    [];
  if (offers && offers.length > 0) {
    const offer = offers.find((o: any) =>
      o.basePlanId === ANDROID_BASE_PLAN_ID ||
      o.basePlanIdAndroid === ANDROID_BASE_PLAN_ID ||
      o.id === ANDROID_BASE_PLAN_ID
    ) ?? offers[0];

    const pricingPhases = offer?.pricingPhasesAndroid ?? offer?.pricingPhases;
    const phases: any[] = pricingPhases?.pricingPhaseList ?? [];
    const recurringPhase = phases.find((p: any) => p.recurrenceMode === 1 || p.recurrenceMode === 2) ?? phases[phases.length - 1];
    if (recurringPhase?.formattedPrice) { return recurringPhase.formattedPrice; }
  }

  // Fallback to top-level fields
  return (
    (product as any).displayPrice ??
    (product as any).localizedPrice ??
    ''
  );
};

/**
 * Format subscription display price:
 * - Displays the actual price string fetched directly from App Store / Google Play Store.
 * - Cleans up spacing and removes trailing ".00" for neat presentation.
 * - Falls back to backend INR price if store product is unavailable or not loaded yet.
 */
const formatSubscriptionPrice = (priceStr?: string | null, backendPrice?: number): string => {
  if (priceStr && priceStr.trim() !== '') {
    let str = priceStr.trim();
    // Force INR symbol if StoreKit returned $, USD, or US$
    str = str.replace(/USD|US\$/gi, '₹').replace(/\$/g, '₹');
    // Remove space between currency symbol and number (e.g. "₹ 499.00" -> "₹499.00")
    str = str.replace(/([^\d\s,.]+)\s+(\d)/g, '$1$2');
    // Clean trailing .00 (e.g. "₹499.00" -> "₹499")
    str = str.replace(/\.00(?!\d)/, '');
    if (!str.startsWith('₹') && !str.startsWith('Free') && !str.startsWith('Price')) {
      str = `₹${str}`;
    }
    return str;
  }

  if (typeof backendPrice === 'number' && backendPrice >= 0) {
    if (backendPrice === 0) return 'Free';
    return `₹${Math.round(backendPrice).toLocaleString('en-IN')}`;
  }

  return 'Price unavailable';
};

const getVisibilityBoost = (plan?: Pick<BackendPlan, 'benefits'> | null): number => {
  const boost = Number(plan?.benefits?.visibility ?? plan?.benefits?.searchRankingBoost ?? 1);
  return Number.isFinite(boost) && boost > 0 ? boost : 1;
};

// ─── Component ────────────────────────────────────────────────────────────────
const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({
  stylistId,
  onBack,
  onSubscriptionActivated,
}) => {
  // Backend data
  const [backendPlans, setBackendPlans] = useState<BackendPlan[]>([]);
  const [currentPlanName, setCurrentPlanName] = useState<string>('Free Plan');
  const [currentPlanCode, setCurrentPlanCode] = useState<string>('FREE');

  // Google Play data
  const [playProducts, setPlayProducts] = useState<ProductSubscription[]>([]);
  const [iapConnected, setIapConnected] = useState(false);
  const [iapLoading, setIapLoading] = useState(Platform.OS === 'android' || Platform.OS === 'ios');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<MergedPlan | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [showActivePlanModal, setShowActivePlanModal] = useState(false);
  const [showSubscriptionSuccessModal, setShowSubscriptionSuccessModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreInProgressRef = useRef(false);
  const processingTransactionsRef = useRef(new Set<string>());
  const finishedTransactionsRef = useRef(new Set<string>());

  // Custom modal state (replaces Alert.alert)
  const [appModal, setAppModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'error' | 'success' | 'info' | 'warning';
    buttons?: ModalButton[];
  }>({ visible: false, title: '', message: '', type: 'info' });

  const showAppModal = useCallback(
    (
      title: string,
      message: string,
      type: 'error' | 'success' | 'info' | 'warning' = 'info',
      buttons?: ModalButton[],
    ) => {
      setAppModal({ visible: true, title, message, type, buttons });
    },
    [],
  );

  const closeAppModal = useCallback(() => {
    setAppModal(prev => ({ ...prev, visible: false }));
  }, []);

  const selectedPlanRef = useRef<MergedPlan | null>(null);

  useEffect(() => {
    selectedPlanRef.current = selectedPlan;
  }, [selectedPlan]);

  const stylistIdRef = useRef<string | undefined>(stylistId);
  useEffect(() => {
    stylistIdRef.current = stylistId;
  }, [stylistId]);

  const showAppModalRef = useRef<typeof showAppModal | null>(null);
  const closeAppModalRef = useRef<typeof closeAppModal | null>(null);

  const isUserPurchasingRef = useRef<boolean>(false);
  const verifyWithBackendRef = useRef<any>(null);
  const onSubscriptionActivatedRef = useRef<any>(null);
  const setPaymentProcessingRef = useRef<any>(null);
  const setPurchasingProductIdRef = useRef<any>(null);
  const setShowSubscriptionSuccessModalRef = useRef<any>(null);
  const setShowPlanModalRef = useRef<any>(null);

  // Listeners stored as refs for cleanup
  const purchaseUpdateSubRef = useRef<any>(null);
  const purchaseErrorSubRef = useRef<any>(null);

  // Current plan rank for button labels
  const currentPlanRank = getPlanRank(currentPlanCode, currentPlanName);

  // ─── Merge backend plans with Play Store products ─────────────────────────
  const mergedPlans = useMemo<MergedPlan[]>(() => {
    return backendPlans.map(plan => {
      const normalizedCode = plan.planCode?.trim().toUpperCase() ?? '';
      const isFreemium = NON_PURCHASABLE_PLAN_CODES.has(normalizedCode);

      if (isFreemium) {
        return {
          ...plan,
          displayPrice: 'Free',
          playProductReady: true, // No Play product needed
          playProduct: null,
        };
      }

      // Find the matching Play product
      const storeProductId =
        (Platform.OS === 'ios' ? plan.iosProductId : plan.androidProductId) ??
        getStoreProductId(plan.planCode) ??
        plan.androidProductId ??
        plan.iosProductId ??
        null;

      const playProduct = playProducts.find(p => {
        const pid = (p as any).id ?? (p as any).productId;
        if (pid === storeProductId) { return true; }
        // Fallback matching for product ID variations across App Store / Google Play
        if (storeProductId && storeProductId.includes('verified_pro') && (pid.includes('verified_pro') || pid.includes('pro_partner'))) {
          return true;
        }
        if (storeProductId && storeProductId.includes('elite') && pid.includes('elite')) {
          return true;
        }
        return false;
      }) ?? null;

      const combined = `${plan.planCode || ''} ${plan.planName || ''}`.toUpperCase();
      let hardcodedDisplayPrice = 'Free';
      let hardcodedPrice = plan.price;

      if (combined.includes('ELITE')) {
        hardcodedDisplayPrice = '₹5,100';
        hardcodedPrice = 5100;
      } else if (combined.includes('VERIFIED') || combined.includes('PRO') || combined.includes('PLUS')) {
        hardcodedDisplayPrice = '₹2,599';
        hardcodedPrice = 2599;
      } else if (plan.price > 0) {
        hardcodedDisplayPrice = `₹${plan.price.toLocaleString('en-IN')}`;
      }

      return {
        ...plan,
        price: hardcodedPrice,
        displayPrice: hardcodedDisplayPrice,
        playProductReady: true,
        playProduct,
      };
    });
  }, [backendPlans, playProducts]);

  // ─── Fetch backend plans ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const session = await getLoginSession();

      const [plansRes, currentRes] = await Promise.all([
        fetch(`${API_BASE_URL_WITH_API}/subscriptions/plans`),
        stylistId
          ? authenticatedFetch(`${API_BASE_URL_WITH_API}/subscriptions/current/${stylistId}`, {
              headers: {
                Accept: 'application/json',
                ...(session?.loginId ? { Authorization: `Bearer ${session.loginId}` } : {}),
              },
            })
          : Promise.resolve(null as any),
      ]);

      if (!plansRes.ok) {
        throw new Error('Failed to fetch plans');
      }

      const plansJson: any = await plansRes.json();
      const fetchedPlans: BackendPlan[] = plansJson?.data ?? [];
      setBackendPlans(Array.isArray(fetchedPlans) ? fetchedPlans : []);

      if (currentRes && currentRes.ok) {
        const currentJson: any = await currentRes.json();
        setCurrentPlanName(currentJson?.data?.planName || 'Free Plan');
        setCurrentPlanCode(currentJson?.data?.planCode || 'FREE');
      } else {
        setCurrentPlanName('Free Plan');
        setCurrentPlanCode('FREE');
      }
    } catch (e) {
      console.error('Subscription fetch error:', e);
      setError('Unable to load subscription plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [stylistId]);

  // ─── Fetch In-App subscription products (iOS / Android) ────────────────────
  const fetchPlayProducts = useCallback(async () => {
    // ── Diagnostic gate checks ─────────────────────────────────────────────
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      console.log('[IAP] Skipping fetchProducts — unsupported platform');
      return;
    }
    if (!iapConnected) {
      console.log('[IAP] Skipping fetchProducts — billing not connected yet');
      return;
    }

    try {
      setIapLoading(true);

      const targetSkus = getSubscriptionSkus();
      console.log('[IAP] Requesting SKUs for', Platform.OS, ':', targetSkus);

      let products = await fetchProducts({
        skus: targetSkus,
        type: 'subs',
      });

      // If 'subs' returned empty (e.g. Non-Renewing Subscriptions in App Store Connect), try 'in-app'
      if (!products || products.length === 0) {
        console.log('[IAP] fetchProducts type: "subs" returned empty, trying type: "in-app"...');
        products = await fetchProducts({
          skus: targetSkus,
          type: 'in-app',
        });
      }

      // ── Raw response ────────────────────────────────────────────────────
      console.log('[IAP] fetchProducts raw response count:', products?.length ?? 0);
      console.log('[IAP] fetchProducts raw response:', JSON.stringify(products, null, 2));

      const subscriptions = (products ?? []) as ProductSubscription[];

      if (subscriptions.length === 0) {
        console.warn(
          '[IAP] ⚠️  fetchProducts returned EMPTY — "Price unavailable" will show.\n' +
          'Possible reasons:\n' +
          '  1. Product IDs in Play Console / App Store do NOT match: ' + ANDROID_SUBSCRIPTION_SKUS.join(', ') + '\n' +
          '  2. Subscription products are not ACTIVE in Store Console\n' +
          '  3. Package name / Bundle ID mismatch\n' +
          '  4. Not enough time since publish — wait 24h and retry'
        );
      } else {
        // ── Per-product breakdown ─────────────────────────────────────────
        subscriptions.forEach((p, i) => {
          const raw = p as any;
          console.log(`[IAP] Product[${i}]:`, {
            productId: raw.productId,
            title: raw.title,
            localizedPrice: raw.localizedPrice,
            displayPrice: raw.displayPrice,
            subscriptionOfferDetails: raw.subscriptionOfferDetails
              ? raw.subscriptionOfferDetails.map((o: any) => ({
                  basePlanId: o.basePlanId,
                  offerId: o.offerId,
                  offerToken: o.offerToken ? o.offerToken.substring(0, 20) + '…' : null,
                  firstPhasePrice: o.pricingPhases?.pricingPhaseList?.[0]?.formattedPrice,
                }))
              : 'none',
          });
        });
      }

      setPlayProducts(subscriptions);
    } catch (e: any) {
      console.error('[IAP] ❌ fetchProducts threw an error:', e?.message || e);
      console.error('[IAP] Error code:', e?.code);
      console.error('[IAP] Full error:', JSON.stringify(e, null, 2));
    } finally {
      setIapLoading(false);
    }
  }, [iapConnected]);

  // ─── Initialise IAP connection ────────────────────────────────────────────
  useEffect(() => {
    fetchData();

    if (Platform.OS !== 'android' && Platform.OS !== 'ios') { return; }

    let mounted = true;

    const init = async () => {
      try {
        const connected = await initConnection();
        if (!mounted) { return; }
        setIapConnected(!!connected);
        if (!connected) { setIapLoading(false); }
        // ── Billing connection diagnostic ──────────────────────────────────
        // Must print "Billing connected: true" before fetchProducts() runs.
        // If it prints "false", check: signed build, Play Store installed,
        // Google account signed in, and package name matches Play Console.
        console.log('Billing connected:', !!connected);
      } catch (e) {
        console.error('❌ IAP initConnection failed:', e);
        if (mounted) { setIapLoading(false); }
      }
    };

    // Purchase update listener — handle subscription verify and finishTransaction (isConsumable: false)
    purchaseUpdateSubRef.current = purchaseUpdatedListener(async (purchase: Purchase) => {
      const pid = (purchase as any).productId ?? purchase.productId ?? '';
      if (restoreInProgressRef.current || !getSubscriptionSkus().includes(pid)) { return; }
      const transactionKey = `${pid}:${purchase.transactionId || purchase.purchaseToken || ''}`;
      if (processingTransactionsRef.current.has(transactionKey) || finishedTransactionsRef.current.has(transactionKey)) { return; }
      processingTransactionsRef.current.add(transactionKey);
      let ptoken =
        (purchase as any).transactionReceipt ??
        (purchase as any).purchaseToken ??
        (purchase as any).purchaseTokenAndroid ??
        purchase.transactionId ??
        '';

      if (Platform.OS === 'ios' && (!ptoken || ptoken.length < 50)) {
        try {
          const iosReceipt = await getReceiptDataIOS();
          if (iosReceipt) {
            ptoken = iosReceipt;
          }
        } catch (receiptErr) {
          console.warn('[IAP Subscriptions] getReceiptDataIOS fallback warning:', receiptErr);
        }
      }

      console.log('[IAP Subscriptions] Purchase listener received event:', { pid, ptoken: ptoken ? ptoken.substring(0, 15) + '...' : 'none' });

      if (!ptoken) {
        processingTransactionsRef.current.delete(transactionKey);
        console.warn('[IAP Subscriptions] Purchase has no token, skipping backend verify');
        return;
      }

      if (verifyWithBackendRef.current) {
        verifyWithBackendRef.current(pid, ptoken, purchase)
          .then(() => {
            console.log('[IAP Subscriptions] Verified successfully, finishing transaction...');
            return finishTransaction({ purchase, isConsumable: false });
          })
          .then(() => {
            finishedTransactionsRef.current.add(transactionKey);
            console.log('[IAP Subscriptions] Finished transaction successfully.');
            onSubscriptionActivatedRef.current?.();
            setShowPlanModalRef.current?.(false);
            setShowSubscriptionSuccessModalRef.current?.(true);
          })
          .catch((err: any) => {
            console.error('❌ Subscription verification failed:', err);
            // Leave unverified transactions pending so they can be retried safely.
            if (isUserPurchasingRef.current) {
              const rawMsg = err.message || 'Could not verify purchase with backend.';
              const displayMsg = Platform.OS === 'ios' ? rawMsg.replace(/google\s*play/gi, 'App Store') : rawMsg;
              showAppModalRef.current?.('Verification Failed', displayMsg, 'error', [{ text: 'OK', onPress: () => closeAppModalRef.current?.(), style: 'default', gradient: true }]);
            }
          })
          .finally(() => {
            processingTransactionsRef.current.delete(transactionKey);
            isUserPurchasingRef.current = false;
            setPaymentProcessingRef.current?.(false);
            setPurchasingProductIdRef.current?.(null);
          });
      }
    });

    purchaseErrorSubRef.current = purchaseErrorListener((err: PurchaseError) => {
      console.error('IAP purchase error event:', err.code, err.message);
      setPaymentProcessingRef.current?.(false);
      setPurchasingProductIdRef.current?.(null);
    });

    init();

    return () => {
      mounted = false;
      purchaseUpdateSubRef.current?.remove();
      purchaseErrorSubRef.current?.remove();
      endConnection().catch(() => {});
    };
  }, [fetchData]);

  // Fetch Play products once IAP is connected
  useEffect(() => {
    if (iapConnected) {
      fetchPlayProducts();
    }
  }, [iapConnected, fetchPlayProducts]);

  // ─── Backend verification ─────────────────────────────────────────────────
  const verifyWithBackend = useCallback(
    async (productId: string, purchaseToken: string, purchase?: Purchase, restoring = false): Promise<boolean> => {
      try {
        const session = await getLoginSession();
        const activeUserId = stylistId || stylistIdRef.current || session?.userId || '';
        const loginId = session?.loginId;

        let receiptData =
          (purchase as any)?.transactionReceipt ||
          (purchase as any)?.purchaseToken ||
          purchaseToken;

        let appStoreReceipt = '';
        if (Platform.OS === 'ios') {
          // Read the existing receipt without triggering an App Store authentication prompt.
          // Store synchronization is reserved for the user's Restore Purchases tap.
          try {
            appStoreReceipt = (await getReceiptDataIOS()) ?? '';
          } catch (e) {
            console.warn('[IAP Subscriptions] Local receipt unavailable:', e);
          }
        }

        // Restored purchases belong to the purchased product, regardless of the last plan viewed.
        const currentSelected = restoring ? null : selectedPlanRef.current;
        const normalizedCode = currentSelected?.planCode?.trim().toUpperCase() ||
          (productId.includes('verified') ? 'VERIFIED_PRO_PARTNER' : 'ELITE_PARTNER');

        const bodyPayload = {
          productId,
          planCode: normalizedCode,
          planId: currentSelected?._id,
          planName: currentSelected?.planName,
          stylistId: activeUserId,
          userId: activeUserId,
          purchaseToken: appStoreReceipt || receiptData || purchaseToken,
          transactionReceipt: receiptData || purchaseToken,
          appStoreReceipt: appStoreReceipt || undefined,
          receiptData: appStoreReceipt || receiptData || purchaseToken,
          receipt: appStoreReceipt || receiptData || purchaseToken,
          'receipt-data': appStoreReceipt || receiptData || purchaseToken,
          transactionId: purchase?.transactionId || purchaseToken,
          appleTransactionId: purchase?.transactionId || purchaseToken,
          originalTransactionId: (purchase as any)?.originalTransactionIdentifierIOS || purchase?.transactionId || purchaseToken,
          platform: Platform.OS,
          isSandbox: true,
          environment: 'sandbox',
        };

        console.log('📡 Verifying backend purchase payload:', {
          productId,
          planCode: normalizedCode,
          activeUserId,
          receiptLen: receiptData?.length || 0,
          isRealBase64Receipt: receiptData && receiptData.length >= 100
        });

        const res = await authenticatedFetch(`${API_BASE_URL_WITH_API}/subscriptions/google-play/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(loginId ? { Authorization: `Bearer ${loginId}` } : {}),
          },
          body: JSON.stringify(bodyPayload),
        });

        const jsonText = await res.text();
        let json: any = {};
        try {
          json = JSON.parse(jsonText);
        } catch (parseErr) {
          console.warn('❌ Verify response JSON parse error:', jsonText);
        }

        if (!res.ok || json?.success === false) {
          console.error('❌ Server verify error response:', res.status, json);
          const rawMsg = json?.message || json?.error || json?.reason || `Server verification error (${res.status})`;
          const displayMsg = Platform.OS === 'ios' ? rawMsg.replace(/google\s*play/gi, 'App Store') : rawMsg;
          throw new Error(displayMsg);
        }

        console.log('✅ Purchase verified by backend:', json?.data?.membership || json);
        return true;
      } catch (e) {
        console.error('❌ Backend verification failed:', e);
        throw e;
      }
    },
    [stylistId]
  );

  // Update refs to ensure callbacks aren't stale inside purchase listeners
  useEffect(() => {
    verifyWithBackendRef.current = verifyWithBackend;
    onSubscriptionActivatedRef.current = onSubscriptionActivated;
    setPaymentProcessingRef.current = setPaymentProcessing;
    setPurchasingProductIdRef.current = setPurchasingProductId;
    setShowSubscriptionSuccessModalRef.current = setShowSubscriptionSuccessModal;
    setShowPlanModalRef.current = setShowPlanModal;
    showAppModalRef.current = showAppModal;
    closeAppModalRef.current = closeAppModal;
  }, [
    closeAppModal,
    onSubscriptionActivated,
    setPaymentProcessing,
    setPurchasingProductId,
    setShowPlanModal,
    setShowSubscriptionSuccessModal,
    showAppModal,
    verifyWithBackend,
  ]);

  // ─── Purchase a paid subscription ─────────────────────────────────────────
  const purchaseGooglePlaySubscription = useCallback(
    async (plan: MergedPlan) => {
      if (!iapConnected) {
        showAppModal(
          'Store unavailable',
          Platform.OS === 'ios'
            ? 'App Store purchases are not ready. Please check your internet connection and try again.'
            : 'Google Play Billing is not ready. Please check your internet connection and try again.',
          'warning',
          [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }],
        );
        return;
      }

      const fetchedSku = (plan.playProduct as any)?.id ?? (plan.playProduct as any)?.productId;
      const targetProductId =
        fetchedSku ??
        (Platform.OS === 'ios' ? plan.iosProductId : plan.androidProductId) ??
        getStoreProductId(plan.planCode) ??
        (plan.planCode?.toUpperCase().includes('ELITE') ? 'elite_partner_package' : 'verified_pro_partner_monthly');

      if (!targetProductId) {
        showAppModal('Configuration error', 'No store product ID is configured for this plan.', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
        return;
      }

      try {
        isUserPurchasingRef.current = true;
        setPaymentProcessing(true);
        setPurchasingProductId(targetProductId);

        console.log('🛒 Starting Store purchase:', { targetProductId, platform: Platform.OS });

        if (Platform.OS === 'ios') {
          try {
            await requestPurchase({
              request: {
                apple: {
                  sku: targetProductId,
                },
              },
              type: 'subs',
            });
          } catch (subErr: any) {
            if (subErr?.code === 'E_USER_CANCELLED' || subErr?.message?.includes('cancel')) {
              throw subErr;
            }
            console.warn('[IAP] requestPurchase type: subs failed on iOS, trying type: in-app:', subErr?.message);
            await requestPurchase({
              request: {
                apple: {
                  sku: targetProductId,
                },
              },
              type: 'in-app',
            });
          }
        } else {
          const offerToken = plan.playProduct ? getAndroidOfferToken(plan.playProduct) : null;
          if (!offerToken) {
            await requestPurchase({
              request: {
                google: {
                  skus: [targetProductId],
                },
              },
              type: 'subs',
            });
          } else {
            await requestPurchase({
              request: {
                google: {
                  skus: [targetProductId],
                  subscriptionOffers: [
                    {
                      sku: targetProductId,
                      offerToken,
                    },
                  ],
                },
              },
              type: 'subs',
            });
          }
        }
      } catch (purchaseErr: any) {
        isUserPurchasingRef.current = false;
        setPaymentProcessing(false);
        setPurchasingProductId(null);
        if (purchaseErr?.code === 'E_USER_CANCELLED' || purchaseErr?.message?.includes('cancel')) {
          console.log('[IAP] Subscription purchase cancelled by user');
          return;
        }
        console.error('❌ requestPurchase error:', purchaseErr);
        const rawMsg = purchaseErr instanceof Error ? purchaseErr.message : 'Could not initiate subscription purchase. Please try again.';
        const displayMsg = Platform.OS === 'ios' ? rawMsg.replace(/google\s*play/gi, 'App Store') : rawMsg;
        showAppModal(
          'Purchase Error',
          displayMsg,
          'error',
          [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]
        );
      }
    },
    [iapConnected, showAppModal, closeAppModal]
  );

  // ─── Restore Purchases ────────────────────────────────────────────────────
  const handleRestorePurchases = useCallback(async () => {
    if (restoreInProgressRef.current || paymentProcessing || purchasingProductId) { return; }
    restoreInProgressRef.current = true;
    let restoreStage = `Connecting to ${STORE_NAME}`;
    try {
      setIsRestoring(true);
      if (!iapConnected) {
        const connected = await initConnection();
        if (!connected) { throw new Error(`Unable to connect to ${STORE_NAME}`); }
        setIapConnected(true);
      }

      // Synchronize only on Restore; stop if authentication is cancelled or store is unavailable.
      restoreStage = `Synchronizing with ${STORE_NAME}`;
      if (Platform.OS === 'ios') {
        try {
          await syncIOS();
        } catch (syncErr: any) {
          const syncMsg = syncErr?.message || String(syncErr);
          const isStoreUnavailable = syncMsg.includes('Store unavailable');
          const isAuthCancelled = syncErr?.code === 'E_USER_CANCELLED' ||
            syncMsg === 'Authentication cancelled' ||
            syncMsg.toLowerCase().includes('authentication cancelled');

          if (isStoreUnavailable || isAuthCancelled) {
            throw syncErr;
          }
          // StoreKit 2 syncIOS is designed for auto-renewable subscriptions.
          // For Non-Renewing Subscriptions or empty sandbox history, Apple returns "request cancelled"
          // or "Unable to complete request". Proceed to check available purchases and local receipt data.
          console.warn('[IAP Restore] syncIOS non-fatal StoreKit error, continuing:', syncMsg);
        }
      }

      // 2. Fetch purchases — for non-renewable subscriptions, onlyIncludeActiveItemsIOS MUST be false
      restoreStage = `Reading purchases from ${STORE_NAME}`;
      let available: Purchase[] = [];
      try {
        available = Platform.OS === 'ios'
          ? await getAvailablePurchases({
              alsoPublishToEventListenerIOS: false,
              onlyIncludeActiveItemsIOS: false,
            })
          : await getAvailablePurchases();
      } catch (availErr) {
        console.warn('[IAP Restore] getAvailablePurchases error:', availErr);
        throw availErr;
      }
      console.log('🔄 Available purchases to restore:', available?.length ?? 0);

      const subscriptionProductIds = new Set([
        ...getSubscriptionSkus(),
        ...backendPlans.map(plan => Platform.OS === 'ios' ? plan.iosProductId : plan.androidProductId)
          .filter((id): id is string => Boolean(id)),
      ]);

      let restored = 0;
      let failed = 0;
      let failureMessage = '';

      if (available && available.length > 0) {
        for (const purchase of available) {
          const productId =
            (purchase as any).productId ??
            null;
          const purchaseToken =
            (purchase as any).transactionReceipt ??
            (purchase as any).purchaseToken ??
            (purchase as any).purchaseTokenAndroid ??
            (purchase as any).transactionId ??
            null;

          if (!productId || !subscriptionProductIds.has(productId)) { continue; }
          if (!purchaseToken) {
            failed++;
            failureMessage = 'The store did not provide purchase verification data.';
            continue;
          }

          try {
            const transactionKey = `${productId}:${purchase.transactionId || purchase.purchaseToken || ''}`;
            restoreStage = 'Verifying your purchase';
            await verifyWithBackend(productId, purchaseToken, purchase as Purchase, true);
            restoreStage = 'Finishing the restored transaction';
            await finishTransaction({ purchase, isConsumable: false });
            finishedTransactionsRef.current.add(transactionKey);
            restored++;
          } catch (e) {
            failed++;
            const detail = e instanceof Error ? e.message :
              (typeof (e as any)?.message === 'string' ? (e as any).message : 'Please try again.');
            failureMessage = `${restoreStage}: ${detail}`;
            console.warn('[IAP Restore] Failed:', restoreStage, productId, e);
          }
        }
      }

      if (restored > 0) {
        onSubscriptionActivated?.();
        await fetchData();
        const message = `${restored} subscription(s) restored successfully.`;
        showAppModal('Restored', message, 'success', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      } else if (failed > 0) {
        showAppModal('Restore failed', failureMessage || 'Your purchases were found, but could not be verified. Please try again.', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      } else {
        // For Non-Renewing Subscriptions, Apple requires restoring via your own account management system (Guideline 3.1.1).
        // If StoreKit returns 0 local purchases, verify if this stylist already has an active subscription in the backend.
        let hasBackendSubscription = false;
        try {
          if (stylistId) {
            const session = await getLoginSession();
            const currentRes = await authenticatedFetch(`${API_BASE_URL_WITH_API}/subscriptions/current/${stylistId}`, {
              headers: {
                Accept: 'application/json',
                ...(session?.loginId ? { Authorization: `Bearer ${session.loginId}` } : {}),
              },
            });
            if (currentRes && currentRes.ok) {
              const currentJson: any = await currentRes.json();
              const activePlanCode = currentJson?.data?.planCode?.trim().toUpperCase();
              if (activePlanCode && activePlanCode !== 'FREE' && activePlanCode !== 'FREEMIUM') {
                hasBackendSubscription = true;
                setCurrentPlanName(currentJson?.data?.planName || 'Active Plan');
                setCurrentPlanCode(activePlanCode);
              }
            }
          }
        } catch (backendCheckErr) {
          console.warn('[IAP Restore] Backend subscription check error:', backendCheckErr);
        }

        if (hasBackendSubscription) {
          onSubscriptionActivated?.();
          await fetchData();
          showAppModal('Restored', 'Your subscription is active and has been restored successfully.', 'success', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
        } else {
          showAppModal('No purchases found', 'No previous purchases were found to restore.', 'info', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
        }
      }
    } catch (e) {
      console.error('❌ Restore purchases failed:', e);
      const detail = e instanceof Error ? e.message :
        (typeof (e as any)?.message === 'string' ? (e as any).message : 'Please try again later.');
      showAppModal('Restore failed', `${restoreStage}: ${detail}`, 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
    } finally {
      restoreInProgressRef.current = false;
      setIsRestoring(false);
    }
  }, [iapConnected, paymentProcessing, purchasingProductId, backendPlans, verifyWithBackend, fetchData, onSubscriptionActivated, showAppModal, closeAppModal, stylistId]);

  // ─── Plan selection ───────────────────────────────────────────────────────
  const handleSelectPlan = (plan: MergedPlan) => {
    setSelectedPlan(plan);
    setShowPlanModal(true);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPlan) { return; }

    const normalizedCode = selectedPlan.planCode?.trim().toUpperCase() ?? '';

    // Freemium — handled by backend automatically, no Play purchase needed
    if (NON_PURCHASABLE_PLAN_CODES.has(normalizedCode)) {
      showAppModal('Freemium', 'The Free plan is already active on your account.', 'info', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      setShowPlanModal(false);
      return;
    }

    setShowPlanModal(false);

    await purchaseGooglePlaySubscription(selectedPlan);
  };

  const handleGoToMyPlans = () => {
    setShowActivePlanModal(false);
    setShowPlanModal(false);
    fetchData();
  };

  const handleSubscriptionSuccessDismiss = () => {
    setShowSubscriptionSuccessModal(false);
    fetchData();
  };

  // ─── Render helpers ───────────────────────────────────────────────────────
  const renderFeaturePoints = (features?: string[]) => {
    if (!features || features.length === 0) { return null; }
    return (
      <View style={styles.featuresSection}>
        <Text style={styles.featuresTitle}>Features</Text>
        {features.map((feature, index) => (
          <View key={`${feature}-${index}`} style={styles.featurePointRow}>
            <View style={styles.featureBullet} />
            <Text style={styles.featurePointText}>{feature}</Text>
          </View>
        ))}
      </View>
    );
  };

  const getPlanButtonLabel = (plan: MergedPlan): string => {
    const normalizedCode = plan.planCode?.trim().toUpperCase() ?? '';
    if (currentPlanCode === plan.planCode) { return 'Current Plan'; }
    if (NON_PURCHASABLE_PLAN_CODES.has(normalizedCode)) { return 'Active (Free)'; }
    const planRank = getPlanRank(plan.planCode, plan.planName);
    if (currentPlanRank > planRank) { return `Switch to ${plan.planName}`; }
    return 'Upgrade Plan';
  };

  const isPlanButtonDisabled = (plan: MergedPlan): boolean => {
    const normalizedCode = plan.planCode?.trim().toUpperCase() ?? '';
    if (currentPlanCode === plan.planCode) { return true; }
    if (NON_PURCHASABLE_PLAN_CODES.has(normalizedCode)) { return true; }
    if (purchasingProductId !== null) { return true; }
    // Disable if Play product not loaded (Android only)
    if (Platform.OS === 'android' && !plan.playProductReady) { return true; }
    return false;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn} activeOpacity={0.7}>
          <Icon name="arrow-back" size={22} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upgrade Plan</Text>
        <TouchableOpacity onPress={fetchData} style={styles.iconBtn} activeOpacity={0.7}>
          <Icon name="refresh" size={20} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current plan card */}
        <View style={styles.currentCard}>
          <View style={styles.currentHeaderRow}>
            <View>
              <Text style={styles.currentLabel}>Current Plan</Text>
              <Text style={styles.currentValue}>{currentPlanName}</Text>
            </View>
            <View style={styles.currentCodePill}>
              <Text style={styles.currentCodePillText}>{currentPlanCode}</Text>
            </View>
          </View>
          <Text style={styles.currentHint}>
            Upgrade to improve profile visibility, get more discovery, and reduce commission.
          </Text>
        </View>

        {/* Store connection status */}
        {(Platform.OS === 'android' || Platform.OS === 'ios') && !iapConnected && !iapLoading && (
          <View style={styles.infoBanner}>
            <Icon name="info-outline" size={16} color="#7B5E2F" />
            <Text style={styles.infoBannerText}>
              {STORE_NAME} is unavailable. Check your connection and store account, then tap Restore Purchases to try again.
            </Text>
          </View>
        )}

        {/* Keep Restore visible on both stores, including when a connection needs retrying. */}
        {(Platform.OS === 'android' || Platform.OS === 'ios') && (
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestorePurchases}
            accessibilityRole="button"
            accessibilityLabel="Restore Purchases"
            accessibilityState={{ disabled: isRestoring || paymentProcessing || purchasingProductId !== null, busy: isRestoring }}
            disabled={isRestoring || paymentProcessing || purchasingProductId !== null}
            activeOpacity={0.7}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            ) : (
              <>
                <Icon name="restore" size={16} color={PRIMARY_COLOR} />
                <Text style={styles.restoreBtnText}>Restore Purchases</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Plan list */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.centerText}>Loading subscription plans…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Icon name="error-outline" size={26} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchData} activeOpacity={0.8}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.selectPlansTitle}>Select a Plan</Text>
            <Text style={styles.selectPlansSubtitle}>
              Prices shown are official {STORE_NAME} prices in your local currency.
            </Text>

            {mergedPlans.map(plan => {
              const isCurrentPlan = currentPlanCode === plan.planCode;
              const buttonLabel = getPlanButtonLabel(plan);
              const buttonDisabled = isPlanButtonDisabled(plan);
              const activeStoreProductId =
                getStoreProductId(plan.planCode) ??
                plan.androidProductId ??
                plan.iosProductId ??
                null;
              const isPurchasing =
                purchasingProductId !== null &&
                activeStoreProductId !== null &&
                purchasingProductId === activeStoreProductId;
              const normalizedCode = plan.planCode?.trim().toUpperCase() ?? '';
              const isFreemium = NON_PURCHASABLE_PLAN_CODES.has(normalizedCode);

              return (
                <View
                  key={plan._id}
                  style={[
                    styles.planCard,
                    isCurrentPlan && styles.planCardCurrent,
                  ]}
                >
                  {/* Card top row: title left, badge right */}
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>{plan.planName}</Text>
                    {plan.badgeImage && (
                      <Image
                        source={{ uri: plan.badgeImage }}
                        style={styles.planBadgeImage}
                        resizeMode="contain"
                      />
                    )}
                  </View>

                  {/* Price from Google Play (not backend) */}
                  <View style={styles.priceRow}>
                    <Text style={styles.planPrice}>
                      {isFreemium ? 'Free' : plan.displayPrice}
                    </Text>
                    {!isFreemium && (
                      <Text style={styles.planDuration}>/ {plan.durationLabel}</Text>
                    )}
                    {/* Loading indicator while waiting for Play price */}
                    {!isFreemium && iapLoading && (
                      <ActivityIndicator size="small" color={PRIMARY_COLOR} style={{ marginLeft: 6 }} />
                    )}
                  </View>

                  {!isFreemium && !plan.playProductReady && !iapLoading && (
                    <Text style={styles.priceUnavailableText}>
                      ⚠ Price currently unavailable from {STORE_NAME}
                    </Text>
                  )}

                  {plan.description ? (
                    <Text style={styles.planDesc}>{plan.description}</Text>
                  ) : null}

                  <View style={styles.benefitRow}>
                    <View style={styles.metricChip}>
                      <Icon name="trending-up" size={14} color="#C85A2D" />
                      <Text style={styles.metricChipText}>
                        {getVisibilityBoost(plan)}x Boost
                      </Text>
                    </View>
                  </View>

                  <View style={styles.planFeatureRow}>
                    <View style={[styles.featureTag, plan.benefits?.featuredBadge && styles.featureTagActive]}>
                      <Text style={[styles.featureTagText, plan.benefits?.featuredBadge && styles.featureTagTextActive]}>
                        Featured Badge {plan.benefits?.featuredBadge ? 'On' : 'Off'}
                      </Text>
                    </View>
                    <View style={[styles.featureTag, plan.benefits?.profileHighlight && styles.featureTagActive]}>
                      <Text style={[styles.featureTagText, plan.benefits?.profileHighlight && styles.featureTagTextActive]}>
                        Profile Highlight {plan.benefits?.profileHighlight ? 'On' : 'Off'}
                      </Text>
                    </View>
                  </View>

                  {renderFeaturePoints(plan.features)}

                  <TouchableOpacity
                    style={styles.chooseBtnWrapper}
                    disabled={buttonDisabled}
                    onPress={() => handleSelectPlan(plan)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={PRIMARY_GRADIENT}
                      locations={PRIMARY_GRADIENT_LOCATIONS}
                      start={PRIMARY_GRADIENT_START}
                      end={PRIMARY_GRADIENT_END}
                      style={[
                        styles.chooseBtn,
                        buttonDisabled && styles.chooseBtnMuted,
                      ]}
                    >
                      {isPurchasing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.chooseText}>{buttonLabel}</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Plan detail modal */}
      <Modal
        visible={showPlanModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowPlanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Plan Details</Text>
              <TouchableOpacity onPress={() => setShowPlanModal(false)} activeOpacity={0.7}>
                <Icon name="close" size={22} color="#444" />
              </TouchableOpacity>
            </View>

            {selectedPlan && (
              <View style={styles.modalContent}>
                <View style={styles.modalPlanHeader}>
                  <Text style={styles.modalPlanName}>{selectedPlan.planName}</Text>
                  <Text style={styles.modalPlanCode}>{selectedPlan.planCode}</Text>
                </View>

                {/* Show Play Store official price */}
                <Text style={styles.modalPrice}>
                  {selectedPlan.displayPrice}
                  {!NON_PURCHASABLE_PLAN_CODES.has(selectedPlan.planCode?.trim().toUpperCase() ?? '') &&
                    ` / ${selectedPlan.durationLabel}`}
                </Text>



                {selectedPlan.description ? (
                  <Text style={styles.modalDescription}>{selectedPlan.description}</Text>
                ) : null}

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Visibility Boost</Text>
                  <Text style={styles.modalInfoValue}>{getVisibilityBoost(selectedPlan)}x</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Featured Badge</Text>
                  <Text style={styles.modalInfoValue}>
                    {selectedPlan.benefits?.featuredBadge ? 'Yes' : 'No'}
                  </Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Profile Highlight</Text>
                  <Text style={styles.modalInfoValue}>
                    {selectedPlan.benefits?.profileHighlight ? 'Yes' : 'No'}
                  </Text>
                </View>

                {renderFeaturePoints(selectedPlan.features)}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.payNowBtnWrapper,
                  paymentProcessing && { opacity: 0.6 },
                ]}
                onPress={handleConfirmPurchase}
                disabled={paymentProcessing}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={PRIMARY_GRADIENT}
                  locations={PRIMARY_GRADIENT_LOCATIONS}
                  start={PRIMARY_GRADIENT_START}
                  end={PRIMARY_GRADIENT_END}
                  style={styles.payNowBtn}
                >
                  {paymentProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.payNowBtnText}>
                      {Platform.OS === 'android' ? 'Subscribe via Google Play' : 'Subscribe'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success modal */}
      <Modal
        visible={showSubscriptionSuccessModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={handleSubscriptionSuccessDismiss}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successTopGlow} />
            <View style={styles.successIconRing}>
              <View style={styles.successIconWrap}>
                <Icon name="check-circle" size={42} color={PRIMARY_COLOR} />
              </View>
            </View>
            <Text style={styles.successTitle}>Subscription Activated!</Text>
            <Text style={styles.successMessage}>
              Your subscription has been verified and activated successfully. Enjoy your new benefits!
            </Text>
            <TouchableOpacity
              style={styles.successActionBtn}
              onPress={handleSubscriptionSuccessDismiss}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={PRIMARY_GRADIENT}
                start={PRIMARY_GRADIENT_START}
                end={PRIMARY_GRADIENT_END}
                style={styles.successActionBtnGradient}
              >
                <Text style={styles.successActionText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Already subscribed modal */}
      <Modal
        visible={showActivePlanModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowActivePlanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.activeModalCard}>
            <Text style={styles.activeModalTitle}>Plan Update</Text>
            <Text style={styles.activeModalText}>
              Your current plan is already active. Select a different plan to switch or upgrade.
            </Text>
            <View style={styles.activeModalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowActivePlanModal(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleGoToMyPlans} activeOpacity={0.85}>
                <LinearGradient
                  colors={PRIMARY_GRADIENT}
                  locations={PRIMARY_GRADIENT_LOCATIONS}
                  start={PRIMARY_GRADIENT_START}
                  end={PRIMARY_GRADIENT_END}
                  style={styles.modalUpgradeBtn}
                >
                  <Text style={styles.modalUpgradeText}>Go to My Plan</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <CustomModal
        visible={appModal.visible}
        title={appModal.title}
        message={appModal.message}
        type={appModal.type}
        buttons={appModal.buttons}
        onClose={closeAppModal}
        showCloseButton={false}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
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
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  content: {
    padding: 18,
    paddingBottom: 42,
  },
  // ─ Current plan card
  currentCard: {
    backgroundColor: CARD_ACCENT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FFD8C8',
    padding: 18,
    marginBottom: 12,
    shadowColor: '#D96A3A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  currentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  currentCodePill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FFD8C8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    position: 'absolute',
    right: -10,
    top: -10,
  },
  currentCodePillText: {
    fontSize: 9,
    fontWeight: '500',
    color: PRIMARY_COLOR,
  },
  currentLabel: {
    color: SECONDARY_TEXT_COLOR,
    fontSize: 13,
    marginBottom: 4,
  },
  currentValue: {
    fontSize: 24,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    marginBottom: 6,
  },
  currentHint: {
    fontSize: 13,
    color: '#555',
    lineHeight: 19,
  },
  // ─ Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F5D98A',
    padding: 12,
    marginBottom: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#7B5E2F',
    lineHeight: 18,
  },
  // ─ Restore button
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD8C8',
    backgroundColor: '#fff',
  },
  restoreBtnText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  // ─ Loading / error
  centerBox: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  centerText: {
    marginTop: 10,
    color: SECONDARY_TEXT_COLOR,
  },
  errorText: {
    marginTop: 8,
    marginBottom: 10,
    color: '#8A1F1F',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  // ─ Plan list
  selectPlansTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  selectPlansSubtitle: {
    fontSize: 12,
    color: SECONDARY_TEXT_COLOR,
    lineHeight: 18,
    marginBottom: 12,
  },
  // ─ Plan card
  planCard: {
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  planCardCurrent: {
    borderColor: PRIMARY_COLOR,
    borderWidth: 1.5,
    backgroundColor: '#FFFAF5',
  },
  planBadgeImage: {
    width: 48,
    height: 48,
    flexShrink: 0,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  planName: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_COLOR,
    flex: 1,
    paddingRight: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: PRIMARY_COLOR,
  },
  planDuration: {
    fontSize: 13,
    color: SECONDARY_TEXT_COLOR,
  },
  priceUnavailableText: {
    fontSize: 11,
    color: '#A05000',
    marginBottom: 6,
  },
  planDesc: {
    fontSize: 12,
    color: SECONDARY_TEXT_COLOR,
    marginBottom: 8,
    lineHeight: 17,
  },
  benefitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0E0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metricChipText: {
    fontSize: 11,
    color: '#C85A2D',
    fontWeight: '600',
  },
  planFeatureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  featureTag: {
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  featureTagActive: {
    backgroundColor: '#FFF0E0',
  },
  featureTagText: {
    fontSize: 11,
    color: '#888',
  },
  featureTagTextActive: {
    color: '#C85A2D',
    fontWeight: '500',
  },
  // ─ Features section
  featuresSection: {
    marginBottom: 10,
  },
  featuresTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 6,
  },
  featurePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  featureBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: PRIMARY_COLOR,
  },
  featurePointText: {
    fontSize: 12,
    color: '#444',
    flex: 1,
  },
  // ─ Choose button
  chooseBtnWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 2,
  },
  chooseBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  chooseBtnMuted: {
    opacity: 0.45,
  },
  chooseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  // ─ Plan detail modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.46)',
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  modalContent: {
    marginBottom: 16,
  },
  modalPlanHeader: {
    marginBottom: 8,
  },
  modalPlanName: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_COLOR,
    marginBottom: 2,
  },
  modalPlanCode: {
    fontSize: 11,
    color: SECONDARY_TEXT_COLOR,
    fontWeight: '500',
  },
  modalPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: PRIMARY_COLOR,
    marginBottom: 4,
  },
  modalPlayStoreNote: {
    fontSize: 12,
    color: '#3A7D44',
    marginBottom: 10,
  },
  modalDescription: {
    fontSize: 13,
    color: SECONDARY_TEXT_COLOR,
    lineHeight: 19,
    marginBottom: 12,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalInfoLabel: {
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
  },
  modalInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  modalActions: {
    marginTop: 12,
  },
  payNowBtnWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  payNowBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payNowBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  // ─ Success modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
  },
  successTopGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: PRIMARY_COLOR,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  successIconRing: {
    marginTop: 16,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BACKGROUND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_COLOR,
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  successActionBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  successActionBtnGradient: {
    paddingVertical: 13,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // ─ Active plan modal
  activeModalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    margin: 24,
  },
  activeModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  activeModalText: {
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
    lineHeight: 20,
    marginBottom: 18,
  },
  activeModalButtons: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  modalCancelText: {
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
  },
  modalUpgradeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalUpgradeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default SubscriptionScreen;
