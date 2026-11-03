import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import CustomModal, { type ModalButton } from '../components/CustomModal';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';
import LinearGradient from '../components/AppLinearGradient';
// @ts-ignore - Razorpay types not available
import RazorpayCheckout from 'react-native-razorpay';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getReceiptIOS,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Product,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import {
  ANDROID_AD_SKUS,
  IOS_AD_SKUS,
  AD_PLAN_ID_TO_ANDROID_SKU,
  getAdSkus,
  getAdStoreProductId,
} from '../constants/subscriptions';

interface AdsScreenProps {
  userId?: string;
  onBack?: () => void;
  onAnalytics?: () => void;
}

interface StylistService {
  _id?: string;
  serviceId?: string;
  serviceName?: string;
  amount?: number;
  category?: string;
}

interface CategoryGroup {
  categoryName: string;
  services: StylistService[];
}

type AdPlanId = 'premium' | 'max' | 'ultimate';

interface AdPlan {
  id: AdPlanId;
  title: string;
  price: number;
  durationDays: number;
  subtitle: string;
  benefits: string[];
  badge?: string;
}

const AD_PLANS: AdPlan[] = [
  {
    id: 'premium',
    title: 'Premium Boosting - 1 Day',
    price: 99,
    durationDays: 1,
    subtitle: 'Get instant visibility when you need it most',
    benefits: [
      'Top of Search for 24 hours: Appear first when clients search in your area + category',
      'Performance Report: See how many extra views, clicks & bookings your boost got',
    ],
  },
  {
    id: 'max',
    title: 'Max Reach Boosting - 3 Days Combo',
    price: 199,
    durationDays: 3,
    subtitle: 'Our best value pack for serious growth',
    benefits: [
      '3x Longer Exposure: Stay at the top for 72 hours straight',
      'Performance Report: See how many extra views, clicks & bookings your boost got',
    ],
    badge: 'BEST',
  },
  {
    id: 'ultimate',
    title: 'Ads: 7 Days',
    price: 299,
    durationDays: 7,
    subtitle: 'Extended visibility for a week-long campaign',
    benefits: [
      '7x Longer Exposure: Stay at the top for 7 days straight',
      'Priority Boost: Get featured in search results all week',
      'Performance Report: See how many extra views, clicks & bookings your boost got',
    ],
  },
];

const PRIMARY_COLOR = '#FD8B36';
const ICON_COLOR = PRIMARY_COLOR;
const BACKGROUND_COLOR = '#FFF3E8';
const TEXT_COLOR = '#1F1F1F';
const SECONDARY_TEXT_COLOR = '#6E6E6E';
const MUTED_TEXT_COLOR = '#B5B5B5';
const CARD_ACCENT = '#FFF5EE';
const BADGE_BG = 'rgba(253, 139, 54, 0.12)';
const PRIMARY_GRADIENT = ['#FD8B36', '#f7bb2c'];
const PRIMARY_GRADIENT_LOCATIONS = [0, 0.7];
const PRIMARY_GRADIENT_START = { x: 0.5, y: 0.5 };
const PRIMARY_GRADIENT_END = { x: 0.5, y: 0 };
const MAX_PROMOTED_SERVICES = 10;
const GST_RATE = 0.18;

const getServiceSelectionKey = (categoryName: string, service: StylistService, index: number) =>
  `${categoryName}-${service._id || service.serviceId || service.serviceName || index}`;

const AdsScreen: React.FC<AdsScreenProps> = ({ userId, onBack, onAnalytics }) => {
  const [services, setServices] = useState<StylistService[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasPaidPromotionAccess, setHasPaidPromotionAccess] = useState(false);
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [selectedPlanId, setSelectedPlanId] = useState<AdPlanId>('premium');
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Google Play states
  const [playProducts, setPlayProducts] = useState<Product[]>([]);
  const [iapConnected, setIapConnected] = useState(false);
  const [iapLoading, setIapLoading] = useState(Platform.OS === 'android');

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

  // References for latest values in listeners
  const userIdRef = useRef<any>(null);
  const selectedPlanRef = useRef<any>(null);
  const pricingRef = useRef<any>(null);
  const selectedServiceCategoryNamesRef = useRef<any>(null);
  const selectedServicesListRef = useRef<any>(null);
  const setPaymentProcessingRef = useRef<any>(null);
  const setHasPaidPromotionAccessRef = useRef<any>(null);
  const showAppModalRef = useRef<typeof showAppModal | null>(null);
  const closeAppModalRef = useRef<typeof closeAppModal | null>(null);

  // Sync refs to avoid stale listener closure state
  useEffect(() => {
    userIdRef.current = userId;
    selectedPlanRef.current = selectedPlan;
    pricingRef.current = pricing;
    selectedServiceCategoryNamesRef.current = selectedServiceCategoryNames;
    selectedServicesListRef.current = selectedServicesList;
    setPaymentProcessingRef.current = setPaymentProcessing;
    setHasPaidPromotionAccessRef.current = setHasPaidPromotionAccess;
    showAppModalRef.current = showAppModal;
    closeAppModalRef.current = closeAppModal;
  });

  // Initialise store connection and purchase listeners
  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') { return; }

    let mounted = true;

    const init = async () => {
      try {
        const connected = await initConnection();
        if (!mounted) { return; }
        setIapConnected(!!connected);
        console.log('[IAP Ads] Billing connected:', !!connected);
      } catch (e) {
        console.error('[IAP Ads] initConnection failed:', e);
        if (mounted) { setIapLoading(false); }
      }
    };

    // Purchase update listener — handle one-time verify and finishTransaction (isConsumable: true)
    const purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      const pid = (purchase as any).productId ?? purchase.productId ?? '';
      let ptoken =
        (purchase as any).transactionReceipt ??
        (purchase as any).purchaseToken ??
        (purchase as any).purchaseTokenAndroid ??
        purchase.transactionId ??
        '';

      if (Platform.OS === 'ios' && (!ptoken || ptoken.length < 50)) {
        try {
          const iosReceipt = await getReceiptIOS();
          if (iosReceipt) {
            ptoken = iosReceipt;
          }
        } catch (e) {
          console.warn('[IAP Ads] getReceiptIOS fallback warning:', e);
        }
      }

      console.log('[IAP Ads] Purchase listener received event:', { pid, ptoken: ptoken ? ptoken.substring(0, 15) + '...' : 'none' });

      if (!ptoken) {
        console.warn('[IAP Ads] Purchase has no token, skipping backend verify');
        return;
      }

      // Check if this is an ad campaign product SKU (iOS or Android)
      if (ANDROID_AD_SKUS.includes(pid) || IOS_AD_SKUS.includes(pid)) {
        console.log('[IAP Ads] Processing campaign verify for SKU:', pid);
        
        let receiptData =
          (purchase as any)?.transactionReceipt ||
          (purchase as any)?.transactionId ||
          ptoken;

        if (Platform.OS === 'ios' && (!receiptData || receiptData.length < 50)) {
          try {
            const fetchedReceipt = await getReceiptIOS();
            if (fetchedReceipt) {
              receiptData = fetchedReceipt;
            }
          } catch (e) {
            console.warn('[IAP Ads] Could not fetch iOS receipt fallback:', e);
          }
        }

        fetch(`${API_BASE_URL_WITH_API}/promotions/google-play/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stylistId: userIdRef.current,
            planId: selectedPlanRef.current?.id,
            planTitle: selectedPlanRef.current?.title,
            categories: selectedServiceCategoryNamesRef.current,
            services: selectedServicesListRef.current?.map((service: any) => ({
              serviceId: service.serviceId || service._id,
              serviceName: service.serviceName,
              category: service.category,
              amount: service.amount,
            })),
            serviceCount: pricingRef.current?.serviceCount,
            durationDays: selectedPlanRef.current?.durationDays,
            benefits: selectedPlanRef.current?.benefits,
            baseAmount: pricingRef.current?.base,
            gstAmount: pricingRef.current?.gstAmount,
            finalAmount: pricingRef.current?.finalAmount,
            productId: pid,
            purchaseToken: ptoken,
            transactionReceipt: receiptData,
            receiptData: receiptData,
            receipt: receiptData,
            transactionId: purchase.transactionId || ptoken,
            platform: Platform.OS,
          }),
        })
          .then(async (res) => {
            const json = await res.json();
            if (!res.ok || !json?.success) {
              throw new Error(json?.message || 'Verification failed');
            }
            console.log('[IAP Ads] Verified successfully, consuming transaction...');
            return finishTransaction({ purchase, isConsumable: true });
          })
          .then(() => {
            console.log('[IAP Ads] Consumed transaction successfully.');
            showAppModalRef.current?.(
              'Campaign Activated',
              `${selectedPlanRef.current?.title || 'Your campaign'} is now live for ${pricingRef.current?.serviceCount || 0} services.`,
              'success',
              [{ text: 'OK', onPress: () => closeAppModalRef.current?.(), style: 'default', gradient: true }],
            );
            setHasPaidPromotionAccessRef.current?.(true);
          })
          .catch((err) => {
            console.error('[IAP Ads] Verification failed:', err);
            const rawMsg = err?.message || 'Could not verify purchase with backend.';
            const displayMsg = Platform.OS === 'ios' ? rawMsg.replace(/google\s*play/gi, 'App Store') : rawMsg;
            showAppModalRef.current?.('Verification Failed', displayMsg, 'error', [{ text: 'OK', onPress: () => closeAppModalRef.current?.(), style: 'default', gradient: true }]);
          })
          .finally(() => {
            setPaymentProcessingRef.current?.(false);
          });
      }
    });

    const purchaseErrorSub = purchaseErrorListener((err: PurchaseError) => {
      console.error('[IAP Ads] Purchase error event:', err.code, err.message);
      setPaymentProcessingRef.current?.(false);
    });

    init();

    return () => {
      mounted = false;
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      endConnection().catch(() => {});
    };
  }, []);

  // Fetch Store ad products (iOS / Android)
  const fetchPlayProducts = useCallback(async () => {
    if ((Platform.OS !== 'android' && Platform.OS !== 'ios') || !iapConnected) { return; }
    try {
      setIapLoading(true);
      const targetSkus = getAdSkus();
      const products = await fetchProducts({
        skus: targetSkus,
        type: 'in-app',
      });
      const inAppItems = (products ?? []) as Product[];
      setPlayProducts(inAppItems);
      console.log('[IAP Ads] Products loaded:', inAppItems.map((p: any) => `${p.id || p.productId}: ${p.displayPrice || p.localizedPrice}`));
    } catch (e) {
      console.error('[IAP Ads] getProducts failed:', e);
    } finally {
      setIapLoading(false);
    }
  }, [iapConnected]);

  useEffect(() => {
    if (iapConnected) {
      fetchPlayProducts();
    }
  }, [iapConnected, fetchPlayProducts]);

  // Create mapping of category ID to category name
  const categoryIdToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat: any) => {
      map.set(cat.categoryId, cat.categoryName);
      map.set(cat._id?.toString(), cat.categoryName);
    });
    return map;
  }, [categories]);

  // Fetch categories from API
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL_WITH_API}/categories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        console.warn(`Failed to fetch categories (${res.status})`);
        setCategories([]);
        return [];
      }

      const result = await res.json();
      const categoriesList = result?.data || [];
      console.log('📥 Categories API response:', result);
      console.log('📂 Categories list:', categoriesList);
      const normalizedCategories = Array.isArray(categoriesList) ? categoriesList : [];
      setCategories(normalizedCategories);
      console.log('✅ Categories fetched:', normalizedCategories.length);
      return normalizedCategories;
    } catch (e) {
      console.error('Error fetching categories:', e);
      setCategories([]);
      return [];
    }
  }, []);

  // Fetch services from API and enrich with category data
  const fetchServices = useCallback(async () => {
    if (!userId) {
      setError('User not found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Fetch categories first
      const fetchedCategories = await fetchCategories();

      const [profileRes, activePromotionsRes] = await Promise.all([
        fetch(`${API_BASE_URL_WITH_API}/profile/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
        fetch(`${API_BASE_URL_WITH_API}/promotions/active?stylistId=${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
      ]);

      if (!profileRes.ok) {
        throw new Error(`Failed to fetch services (${profileRes.status})`);
      }

      const [result, activePromotionsResult] = await Promise.all([
        profileRes.json(),
        activePromotionsRes.ok ? activePromotionsRes.json() : Promise.resolve(null),
      ]);
      console.log('📥 Profile API response:', result);

      const hasActivePromotionFromProfile = Boolean(result?.data?.promotion?.hasActivePromotion);
      const hasActivePromotionFromCampaigns =
        Array.isArray(activePromotionsResult?.data) && activePromotionsResult.data.length > 0;
      const hasSubscriptionAdAccess = Boolean(result?.data?.isPlusPlanActive);

      setHasPaidPromotionAccess(
        hasActivePromotionFromCampaigns || hasActivePromotionFromProfile || hasSubscriptionAdAccess,
      );
      
      const selected = result?.data?.selectedServices;
      console.log('📋 Selected services from profile:', selected);
      
      let list = Array.isArray(selected) ? selected : [];
      console.log('📦 Services to be used:', list);
      console.log('🔍 First service structure:', list[0]);
      
      // Build service-to-category mapping by fetching each category's services
      console.log('🔄 Building category-to-services map...');
      const serviceToCategoryMap = new Map<string, string>();
      
      if (fetchedCategories.length > 0) {
        for (const category of fetchedCategories) {
          try {
            const categoryRes = await fetch(
              `${API_BASE_URL_WITH_API}/categories/${category.categoryId || category._id}/services`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
              }
            );

            if (categoryRes.ok) {
              const categoryResult = await categoryRes.json();
              const categoryServices = categoryResult?.data?.services || categoryResult?.data || [];
              
              console.log(`📂 Category "${category.categoryName}": ${categoryServices.length} services`);
              
              // Map each service in this category
              (Array.isArray(categoryServices) ? categoryServices : []).forEach((svc: any) => {
                const serviceName = svc.serviceName || svc.name;
                if (serviceName) {
                  serviceToCategoryMap.set(serviceName.toLowerCase(), category.categoryName);
                  console.log(`  📌 Mapped: ${serviceName} → ${category.categoryName}`);
                }
              });
            }
          } catch (e) {
            console.warn(`⚠️ Failed to fetch services for category ${category.categoryName}:`, e);
          }
        }
      }

      // Enrich selected services with category data
      list = list.map((service: any) => {
        const serviceName = service.serviceName || service.name || '';
        const mappedCategory = serviceToCategoryMap.get(serviceName.toLowerCase());
        const finalCategory = mappedCategory || service.category || 'Uncategorized';
        
        console.log(`✏️ Service "${serviceName}" → Category: "${finalCategory}"`);
        
        return {
          ...service,
          category: finalCategory,
        };
      });
      
      console.log('✅ Services enriched with categories:', list);
      
      setServices(list);
      setSelectedCategoryNames([]);
      setSelectedServices(new Set());
    } catch (e) {
      console.error('Ads screen fetch services error:', e);
      setServices([]);
      setError('Unable to load your services right now');
    } finally {
      setLoading(false);
    }
  }, [userId, fetchCategories]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Group services by category and get proper category names from mapping
  const groupedByCategory = useMemo(() => {
    console.log('🔍 Grouping services...');
    console.log('📦 Services count:', services.length);
    console.log('📂 Categories count:', categories.length);
    console.log('🗺️ Category mapping:', Array.from(categoryIdToNameMap.entries()));
    
    const groups: { [key: string]: StylistService[] } = {};
    
    services.forEach((service, idx) => {
      console.log(`📋 Service ${idx}:`, service);
      
      // Try to get category name from service field
      let categoryName = 'Uncategorized';
      
      if (service.category) {
        // First check if category is an ID that we can map
        const mappedName = categoryIdToNameMap.get(service.category);
        if (mappedName) {
          categoryName = mappedName;
        } else {
          // Otherwise use the category field as-is (might already be a name)
          categoryName = service.category;
        }
      }
      
      console.log(`  ➜ Mapped to category: "${categoryName}"`);
      
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(service);
    });

    const result = Object.entries(groups).map(([categoryName, categoryServices]) => ({
      categoryName,
      services: categoryServices,
    }));
    
    console.log('✅ Final grouped result:', result);
    return result;
  }, [services, categoryIdToNameMap]);

  const mergedAdPlans = useMemo(() => {
    return AD_PLANS.map(plan => {
      const storeProductId = getAdStoreProductId(plan.id);
      const playProduct = playProducts.find(p => ((p as any).id ?? (p as any).productId) === storeProductId);

      return {
        ...plan,
        title: playProduct?.title ? playProduct.title.replace(/\s*\(.*\)\s*$/, '') : plan.title,
        subtitle: playProduct?.description || plan.subtitle,
        price: plan.price,
        displayPrice: `₹${plan.price}`,
        playProductReady: true,
      };
    });
  }, [playProducts]);

  const selectedPlan = useMemo(
    () => mergedAdPlans.find((plan) => plan.id === selectedPlanId) || mergedAdPlans[1],
    [selectedPlanId, mergedAdPlans],
  );

  const selectedServicesList = useMemo(() => {
    return groupedByCategory.flatMap(group =>
      group.services
        .map((service, index) => ({
          ...service,
          selectionKey: getServiceSelectionKey(group.categoryName, service, index),
          category: group.categoryName,
        }))
        .filter(service => selectedServices.has(service.selectionKey)),
    );
  }, [groupedByCategory, selectedServices]);

  const selectedServiceCategoryNames = useMemo(() => {
    return Array.from(new Set(selectedServicesList.map(service => service.category || 'Uncategorized')));
  }, [selectedServicesList]);

  const pricing = useMemo(() => {
    const serviceCount = selectedServicesList.length;
    const base = serviceCount > 0 ? selectedPlan.price : 0;
    const gstAmount = 0;
    const finalAmount = base;

    return {
      categoryCount: selectedServiceCategoryNames.length,
      serviceCount,
      base,
      gstAmount,
      finalAmount,
    };
  }, [selectedPlan.price, selectedServiceCategoryNames.length, selectedServicesList.length]);

  const formatAmount = (amount?: number | null) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  const toggleCategory = (categoryName: string) => {
    setSelectedCategoryNames((prev) =>
      prev.includes(categoryName)
        ? prev.filter((item) => item !== categoryName)
        : [...prev, categoryName],
    );
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        if (newSet.size >= MAX_PROMOTED_SERVICES) {
          showAppModal('Service Limit Reached', `Only ${MAX_PROMOTED_SERVICES} services can be selected for one ad campaign.`, 'warning', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
          return prev;
        }
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const selectAllCategories = () => {
    const nextSelectedServices = new Set<string>();
    const expandedCategories = new Set<string>();

    groupedByCategory.forEach((group) => {
      group.services.forEach((service, index) => {
        if (nextSelectedServices.size >= MAX_PROMOTED_SERVICES) {
          return;
        }

        nextSelectedServices.add(getServiceSelectionKey(group.categoryName, service, index));
        expandedCategories.add(group.categoryName);
      });
    });

    setSelectedServices(nextSelectedServices);
    setSelectedCategoryNames(Array.from(expandedCategories));
  };

  const clearSelectedCategories = () => {
    setSelectedServices(new Set());
    setSelectedCategoryNames([]);
  };

  const selectAllServicesInCategory = (group: CategoryGroup) => {
    setSelectedServices((prev) => {
      const newSet = new Set(prev);
      let limitReached = false;

      group.services.forEach((service, index) => {
        if (newSet.has(getServiceSelectionKey(group.categoryName, service, index))) {
          return;
        }

        if (newSet.size >= MAX_PROMOTED_SERVICES) {
          limitReached = true;
          return;
        }

        newSet.add(getServiceSelectionKey(group.categoryName, service, index));
      });

      if (limitReached) {
        showAppModal('Service Limit Reached', `Only ${MAX_PROMOTED_SERVICES} services can be selected for one ad campaign.`, 'warning', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      }

      return newSet;
    });

    setSelectedCategoryNames((prev) =>
      prev.includes(group.categoryName) ? prev : [...prev, group.categoryName],
    );
  };

  const clearServicesInCategory = (group: CategoryGroup) => {
    setSelectedServices((prev) => {
      const newSet = new Set(prev);
      group.services.forEach((service, index) => {
        newSet.delete(getServiceSelectionKey(group.categoryName, service, index));
      });
      return newSet;
    });
  };

  const toggleAllServicesInCategory = (group: CategoryGroup, areAllServicesSelected: boolean) => {
    if (areAllServicesSelected) {
      clearServicesInCategory(group);
      return;
    }

    selectAllServicesInCategory(group);
  };

  const verifyPromotionPayment = useCallback(async (orderId: string, paymentId: string | null, signature?: string) => {
    if (!userId) {
      showAppModal('Error', 'Stylist not found', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/promotions/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stylistId: userId,
          planId: selectedPlan.id,
          planTitle: selectedPlan.title,
          categories: selectedServiceCategoryNames,
          services: selectedServicesList.map(service => ({
            serviceId: service.serviceId || service._id,
            serviceName: service.serviceName,
            category: service.category,
            amount: service.amount,
          })),
          serviceCount: pricing.serviceCount,
          durationDays: selectedPlan.durationDays,
          benefits: selectedPlan.benefits,
          baseAmount: pricing.base,
          gstAmount: pricing.gstAmount,
          finalAmount: pricing.finalAmount,
          orderId,
          paymentId,
          signature,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to activate campaign');
      }

      showAppModal(
        'Campaign Activated',
        `${selectedPlan.title} is now live for ${pricing.serviceCount} service${pricing.serviceCount === 1 ? '' : 's'}.`,
        'success',
        [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }],
      );
      setHasPaidPromotionAccess(true);
    } catch (verifyError) {
      console.error('❌ Error verifying promotion payment:', verifyError);
      showAppModal('Verification Failed', verifyError instanceof Error ? verifyError.message : 'Failed to verify promotion payment.', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
    } finally {
      setPaymentProcessing(false);
    }
  }, [pricing.base, pricing.finalAmount, pricing.gstAmount, pricing.serviceCount, selectedPlan, selectedServiceCategoryNames, selectedServicesList, userId]);

  // Store billing purchase handler for ad campaigns
  const purchaseStoreAdCampaign = useCallback(async (sku: string) => {
    if (!iapConnected) {
      showAppModal('Store unavailable', 'The in-app purchase system is not ready. Please try again later.', 'warning', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      return;
    }

    const product = playProducts.find(p => ((p as any).id ?? (p as any).productId) === sku);
    if (!product) {
      showAppModal('Product unavailable', 'This campaign product is not configured in the app store catalog.', 'warning', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      return;
    }

    try {
      setPaymentProcessing(true);
      console.log('[IAP Ads] Requesting purchase for SKU:', sku, 'on', Platform.OS);

      // requestPurchase launches the native store sheet and resolves.
      // Verification is handled asynchronously in the purchaseUpdatedListener.
      if (Platform.OS === 'ios') {
        await requestPurchase({
          request: {
            apple: {
              sku,
            },
          },
          type: 'in-app',
        });
      } else {
        await requestPurchase({
          request: {
            google: {
              skus: [sku],
            },
          },
          type: 'in-app',
        });
      }

      console.log('[IAP Ads] Purchase request completed, awaiting listener callback...');
    } catch (e: any) {
      if (e?.code === 'E_USER_CANCELLED' || e?.message?.includes('cancel')) {
        console.log('[IAP Ads] Purchase cancelled by user');
        setPaymentProcessing(false);
        return;
      }
      console.error('[IAP Ads] Purchase error:', e);
      showAppModal('Payment Failed', e instanceof Error ? e.message : 'Store purchase failed. Please try again.', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      setPaymentProcessing(false);
    }
  }, [iapConnected, playProducts]);

  const openRazorpayPayment = useCallback((orderId: string, amount: number) => {
    try {
      // Fetch LIVE Razorpay key from backend (required)
      fetch(`${API_BASE_URL_WITH_API}/payment/razorpay-key`)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error('Failed to fetch Razorpay key from backend');
          }
          const keyData = await res.json();
          const razorpayKey = keyData.data?.key;
          if (!razorpayKey) {
            throw new Error('No Razorpay key received from backend');
          }
          console.log('✅ Razorpay live key fetched from backend');

          const options = {
            key: razorpayKey,
            description: `${selectedPlan.title} promotion`,
            image: 'https://i.pinimg.com/originals/8f/14/57/8f14579efb86dd55b6ba6e54be6fc5e5.png',
            order_id: orderId,
            currency: 'INR',
            amount: amount * 100,
            name: 'Glammefy',
            prefill: {
              email: `stylist_${userId}@glammefy.com`,
            },
            theme: { color: PRIMARY_COLOR },
          };

          RazorpayCheckout.open(options)
            .then(async (data: any) => {
              await verifyPromotionPayment(
                orderId,
                data.razorpay_payment_id,
                data.razorpay_signature,
              );
            })
            .catch((paymentError: any) => {
              console.error('❌ Razorpay error:', paymentError);
              showAppModal('Payment Failed', paymentError?.description || 'Please try again', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
              setPaymentProcessing(false);
            });
        })
        .catch((fetchError) => {
          console.error('❌ Error fetching Razorpay key:', fetchError);
          showAppModal('Error', 'Failed to initialize payment. Please try again.', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
          setPaymentProcessing(false);
        });
    } catch (paymentOpenError) {
      console.error('❌ Error opening Razorpay:', paymentOpenError);
      showAppModal('Error', 'Could not open payment. Please try again.', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      setPaymentProcessing(false);
    }
  }, [selectedPlan.title, userId, verifyPromotionPayment]);

  const handleCreateCampaign = async () => {
    if (pricing.serviceCount === 0) {
      showAppModal('Select Services', 'Please select at least one service to create an ad campaign.', 'info', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      return;
    }

    if (pricing.serviceCount > MAX_PROMOTED_SERVICES) {
      showAppModal('Service Limit Reached', `Please select no more than ${MAX_PROMOTED_SERVICES} services.`, 'warning', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      return;
    }

    if (!userId) {
      showAppModal('Error', 'Stylist not found', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      return;
    }

    // On iOS & Android, launch App Store / Google Play In-App Purchase directly
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const sku = getAdStoreProductId(selectedPlan.id);
      if (!sku) {
        showAppModal('Error', 'Store product code mapping is missing for this plan', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
        return;
      }
      await purchaseStoreAdCampaign(sku);
      return;
    }

    try {
      setPaymentProcessing(true);

      const response = await fetch(`${API_BASE_URL_WITH_API}/promotions/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stylistId: userId,
          planId: selectedPlan.id,
          planTitle: selectedPlan.title,
          categories: selectedServiceCategoryNames,
          services: selectedServicesList.map(service => ({
            serviceId: service.serviceId || service._id,
            serviceName: service.serviceName,
            category: service.category,
            amount: service.amount,
          })),
          serviceCount: pricing.serviceCount,
          durationDays: selectedPlan.durationDays,
          benefits: selectedPlan.benefits,
          baseAmount: pricing.base,
          gstAmount: pricing.gstAmount,
          finalAmount: pricing.finalAmount,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to create promotion order');
      }

      const orderId = result?.data?.orderId;
      const amount = Number(result?.data?.amount || 0);

      if (!orderId) {
        throw new Error('No order ID received from server');
      }

      if (amount > 0) {
        openRazorpayPayment(orderId, amount);
      } else {
        await verifyPromotionPayment(orderId, null);
      }
    } catch (orderError) {
      console.error('❌ Error creating promotion order:', orderError);
      showAppModal('Error', orderError instanceof Error ? orderError.message : 'Failed to create campaign payment.', 'error', [{ text: 'OK', onPress: closeAppModal, style: 'default', gradient: true }]);
      setPaymentProcessing(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn} activeOpacity={0.7}>
          <Icon name="arrow-back" size={22} color={ICON_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ads & Promotions</Text>
        <TouchableOpacity onPress={() => { setLoading(true); fetchServices(); }} style={styles.iconBtn} activeOpacity={0.7}>
          <Icon name="refresh" size={20} color={ICON_COLOR} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Text style={styles.heroEyebrow}>SERVICE PROMOTION</Text>
              <Icon name="campaign" size={20} color={ICON_COLOR} />
            </View>
            <Text style={styles.heroTitle}>Promote your services with Ads</Text>
            <Text style={styles.heroSubtitle}>
              Choose up to {MAX_PROMOTED_SERVICES} services from any category, select a boost plan, and increase visibility in search and home feed.
            </Text>
            <View style={styles.heroBadge}>
              <Icon name="auto-awesome" size={14} color={PRIMARY_COLOR} />
              <Text style={styles.heroBadgeText}>Select any {MAX_PROMOTED_SERVICES} services across categories</Text>
            </View>
            {hasPaidPromotionAccess && onAnalytics ? (
              <TouchableOpacity style={styles.analyticsShortcut} onPress={onAnalytics} activeOpacity={0.85}>
                <Icon name="analytics" size={18} color="#fff" />
                <Text style={styles.analyticsShortcutText}>View Analytics</Text>
              </TouchableOpacity>
            ) : null}
          </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.centerText}>Loading your services...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Icon name="error-outline" size={28} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchServices} activeOpacity={0.8}>
              <LinearGradient
                colors={PRIMARY_GRADIENT}
                locations={PRIMARY_GRADIENT_LOCATIONS}
                start={PRIMARY_GRADIENT_START}
                end={PRIMARY_GRADIENT_END}
                style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Select Up To {MAX_PROMOTED_SERVICES} Services</Text>
                <Text style={styles.sectionSubtitle}>{pricing.serviceCount}/{MAX_PROMOTED_SERVICES} selected</Text>
              </View>

              {groupedByCategory.length === 0 ? (
                <View style={styles.emptyState}>
                  <Icon name="room-service" size={26} color={MUTED_TEXT_COLOR} />
                  <Text style={styles.emptyTitle}>No categories available</Text>
                  <Text style={styles.emptySubtitle}>
                    Add services in My Service first, then create ads for them.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.inlineActions}>
                    <TouchableOpacity onPress={selectAllCategories} activeOpacity={0.8}>
                      <LinearGradient
                        colors={PRIMARY_GRADIENT}
                        locations={PRIMARY_GRADIENT_LOCATIONS}
                        start={PRIMARY_GRADIENT_START}
                        end={PRIMARY_GRADIENT_END}
                        style={styles.inlineBtn}>
                        <Text style={styles.inlineBtnText}>Select {MAX_PROMOTED_SERVICES}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.inlineBtnGhost} onPress={clearSelectedCategories} activeOpacity={0.8}>
                      <Text style={styles.inlineBtnGhostText}>Clear</Text>
                    </TouchableOpacity>
                  </View>

                  {groupedByCategory.map((group, _groupIdx) => {
                    const isExpanded = selectedCategoryNames.includes(group.categoryName);
                    const selectedInGroup = group.services.filter((service, serviceIdx) =>
                      selectedServices.has(getServiceSelectionKey(group.categoryName, service, serviceIdx)),
                    ).length;
                    const areAllServicesInGroupSelected = group.services.length > 0 && selectedInGroup === group.services.length;
                    return (
                      <View key={group.categoryName} style={styles.categoryGroup}>
                        {/* Category Header */}
                        <TouchableOpacity
                          style={[styles.categoryHeader, isExpanded && styles.categoryHeaderSelected]}
                          onPress={() => toggleCategory(group.categoryName)}
                          activeOpacity={0.8}>
                          <View style={styles.categoryHeaderLeft}>
                            <View style={[styles.categoryIconWrap, isExpanded && styles.categoryIconWrapSelected]}>
                              <Icon name="category" size={18} color={isExpanded ? '#fff' : PRIMARY_COLOR} />
                            </View>
                            <View>
                              <Text style={styles.categoryHeaderTitle}>{group.categoryName}</Text>
                              <Text style={styles.categoryHeaderCount}>
                                {selectedInGroup}/{group.services.length} selected
                              </Text>
                            </View>
                          </View>
                          <Icon
                            name={isExpanded ? 'expand-less' : 'expand-more'}
                            size={24}
                            color={isExpanded ? PRIMARY_COLOR : MUTED_TEXT_COLOR}
                          />
                        </TouchableOpacity>

                        {/* Services under category */}
                        {isExpanded && (
                          <View style={styles.servicesList}>
                            <TouchableOpacity
                              style={styles.categorySelectAllRow}
                              onPress={() => toggleAllServicesInCategory(group, areAllServicesInGroupSelected)}
                              activeOpacity={0.75}>
                              <Icon
                                name={areAllServicesInGroupSelected ? 'check-box' : 'check-box-outline-blank'}
                                size={20}
                                color={areAllServicesInGroupSelected ? PRIMARY_COLOR : '#ccc'}
                              />
                              <Text style={styles.categorySelectAllText}>
                                {areAllServicesInGroupSelected ? 'Clear all services in this category' : 'Select all services in this category'}
                              </Text>
                            </TouchableOpacity>
                            {group.services.map((service, serviceIdx) => {
                              const serviceKey = getServiceSelectionKey(group.categoryName, service, serviceIdx);
                              const isServiceSelected = selectedServices.has(serviceKey);
                              const isServiceLimitReached = !isServiceSelected && pricing.serviceCount >= MAX_PROMOTED_SERVICES;
                              return (
                                <TouchableOpacity
                                  key={serviceKey}
                                  style={[
                                    styles.serviceItem,
                                    isServiceSelected && styles.serviceItemSelected,
                                    isServiceLimitReached && styles.serviceItemDisabled,
                                  ]}
                                  onPress={() => toggleService(serviceKey)}
                                  disabled={isServiceLimitReached}
                                  activeOpacity={0.7}>
                                  <Icon
                                    name={isServiceSelected ? 'check-box' : 'check-box-outline-blank'}
                                    size={20}
                                    color={isServiceSelected ? PRIMARY_COLOR : '#ccc'}
                                  />
                                  <View style={styles.serviceItemInfo}>
                                    <Text style={styles.serviceItemName}>{service.serviceName}</Text>
                                    <Text style={styles.serviceItemPrice}>
                                      ₹{Number(service.amount || 0).toLocaleString('en-IN')}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Choose Ad Plan</Text>
              <Text style={styles.planHint}>Each plan is one package for up to {MAX_PROMOTED_SERVICES} selected services across any categories.</Text>
              {mergedAdPlans.map((plan) => {
                const selected = plan.id === selectedPlanId;
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[styles.planCard, selected && styles.planCardSelected]}
                    onPress={() => setSelectedPlanId(plan.id)}
                    activeOpacity={0.85}>
                    <View style={styles.planTopRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.planTitleRow}>
                          <Text style={styles.planTitle}>{plan.title}</Text>
                          {plan.badge ? (
                            <View style={styles.planBadge}>
                              <Text style={styles.planBadgeText}>{plan.badge}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
                      </View>
                      <View style={styles.planPriceWrap}>
                        <Text style={styles.planPrice}>{plan.displayPrice}</Text>
                        <Text style={styles.planPriceUnit}>/{plan.durationDays} day{plan.durationDays > 1 ? 's' : ''}</Text>
                      </View>
                    </View>
                    {plan.benefits.map((benefit) => (
                      <View key={`${plan.id}-${benefit}`} style={styles.benefitRow}>
                        <Icon name="check" size={16} color={PRIMARY_COLOR} />
                        <Text style={styles.benefitText}>{benefit}</Text>
                      </View>
                    ))}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Campaign Summary</Text>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText} numberOfLines={1}>{selectedPlan.title}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Selected Categories</Text>
                <Text style={styles.summaryValue}>{pricing.categoryCount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Selected Services</Text>
                <Text style={styles.summaryValue}>{pricing.serviceCount}/{MAX_PROMOTED_SERVICES}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>
                  {selectedPlan.durationDays} day{selectedPlan.durationDays > 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Package Amount</Text>
                <Text style={styles.summaryValue}>{formatAmount(pricing.base)}</Text>
              </View>

              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>Estimated Total</Text>
                <Text style={styles.summaryTotalValue}>
                  {formatAmount(pricing.finalAmount)}
                </Text>
              </View>

                  <TouchableOpacity
                    style={styles.createBtnWrapper}
                    disabled={pricing.serviceCount === 0 || groupedByCategory.length === 0 || paymentProcessing}
                    onPress={handleCreateCampaign}
                    activeOpacity={0.85}>
                    <LinearGradient
                      colors={PRIMARY_GRADIENT}
                      locations={PRIMARY_GRADIENT_LOCATIONS}
                      start={PRIMARY_GRADIENT_START}
                      end={PRIMARY_GRADIENT_END}
                      style={[
                        styles.createBtn,
                        (pricing.serviceCount === 0 || groupedByCategory.length === 0 || paymentProcessing) && styles.createBtnDisabled,
                      ]}>
                      <Text style={styles.createBtnText}>
                        {paymentProcessing ? 'Processing Payment...' : 'Create Ad Campaign'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: TEXT_COLOR,
  },
  content: {
    padding: 18,
    paddingBottom: 34,
  },
  heroCard: {
    backgroundColor: CARD_ACCENT,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(253, 139, 54, 0.4)',
    shadowColor: 'rgba(253, 139, 54, 0.2)',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroEyebrow: {
    fontSize: 13,
    color: TEXT_COLOR,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
    lineHeight: 18,
  },
  heroBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BADGE_BG,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(253, 139, 54, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    fontSize: 12,
    color: TEXT_COLOR,
    fontWeight: '600',
  },
  analyticsShortcut: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  analyticsShortcutText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  centerBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 26,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
  },
  centerText: {
    marginTop: 10,
    color: SECONDARY_TEXT_COLOR,
  },
  errorText: {
    marginTop: 10,
    marginBottom: 12,
    color: '#8A1F1F',
    textAlign: 'center',
  },
  retryBtn: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: SECONDARY_TEXT_COLOR,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
    lineHeight: 18,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  inlineBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  inlineBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineBtnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FAFAFA',
  },
  inlineBtnGhostText: {
    color: SECONDARY_TEXT_COLOR,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 9,
    backgroundColor: '#fff',
  },
  categoryCardSelected: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#FFF6F1',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF1EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconWrapSelected: {
    backgroundColor: PRIMARY_COLOR,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 2,
  },
  categoryServices: {
    fontSize: 13,
    color: SECONDARY_TEXT_COLOR,
    marginBottom: 6,
  },
  categoryServicesList: {
    marginTop: 4,
  },
  serviceListItem: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  serviceListMore: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    marginTop: 2,
  },
  categoryGroup: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: '#fff',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: '#FAFAFA',
  },
  categoryHeaderSelected: {
    backgroundColor: '#FFF6F1',
    borderBottomColor: PRIMARY_COLOR,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  categoryHeaderCount: {
    fontSize: 12,
    color: SECONDARY_TEXT_COLOR,
    marginTop: 2,
  },
  servicesList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  categorySelectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFF6F1',
    marginBottom: 8,
  },
  categorySelectAllText: {
    flex: 1,
    marginLeft: 10,
    color: TEXT_COLOR,
    fontSize: 13,
    fontWeight: '600',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    borderLeftWidth: 3,
    borderLeftColor: '#e0e0e0',
  },
  serviceItemSelected: {
    backgroundColor: '#FFF6F1',
    borderLeftColor: PRIMARY_COLOR,
  },
  serviceItemDisabled: {
    opacity: 0.45,
  },
  serviceItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  serviceItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_COLOR,
  },
  serviceItemPrice: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    marginTop: 2,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 9,
    backgroundColor: '#fff',
  },
  serviceCardSelected: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#FFF6F1',
  },
  serviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  serviceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF1EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconWrapSelected: {
    backgroundColor: PRIMARY_COLOR,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: TEXT_COLOR,
  },
  servicePrice: {
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
    marginTop: 2,
  },
  planHint: {
    color: '#777',
    fontSize: 12,
    marginBottom: 8,
  },
  planCard: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  planCardSelected: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#FFFBF7',
  },
  planTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  planBadge: {
    backgroundColor: BADGE_BG,
    borderWidth: 1,
    borderColor: 'rgba(253, 139, 54, 0.5)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planBadgeText: {
    color: TEXT_COLOR,
    fontSize: 12,
    fontWeight: '600',
  },
  planSubtitle: {
    fontSize: 14,
    color: '#777',
  },
  planPriceWrap: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  planPriceUnit: {
    fontSize: 12,
    color: SECONDARY_TEXT_COLOR,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  benefitText: {
    fontSize: 14,
    color: '#4D4D4D',
    flex: 1,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  durationChip: {
    borderWidth: 1,
    borderColor: '#E7DDD8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  durationChipSelected: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#FFF1F0',
  },
  durationChipText: {
    fontSize: 12,
    color: SECONDARY_TEXT_COLOR,
    fontWeight: '600',
  },
  durationChipTextSelected: {
    color: PRIMARY_COLOR,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 14,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  summaryPill: {
    backgroundColor: BADGE_BG,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(253, 139, 54, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    flex: 1,
    maxWidth: '50%',
  },
  summaryPillText: {
    fontSize: 12,
    color: TEXT_COLOR,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E7E2',
  },
  summaryLabel: {
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
  },
  summaryValue: {
    fontSize: 13,
    color: TEXT_COLOR,
    fontWeight: '600',
  },
  summaryTotal: {
    backgroundColor: '#FFF3ED',
    borderBottomWidth: 0,
    marginHorizontal: -14,
    paddingHorizontal: 14,
    marginTop: 4,
    borderRadius: 10,
  },
  summaryTotalLabel: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontWeight: '700',
  },
  summaryTotalValue: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    fontWeight: '800',
  },
  createBtn: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  createBtnWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  createBtnDisabled: {
    opacity: 0.55,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default AdsScreen;
