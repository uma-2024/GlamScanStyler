import { QueuedModal as Modal } from '../popup/PopupProvider';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Switch,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API, ADMIN_PANEL_API_URL } from '../config/api';
import Shimmer from '../components/Shimmer';
import CustomModal from '../components/CustomModal';
import { useModal } from '../hooks/useModal';
import LinearGradient from '../components/AppLinearGradient';
import { toCloudFrontUrl } from '../utils/cdnUrl';
import SmoothToggle from '../components/SmoothToggle';

interface MyServiceScreenProps {
  userId?: string;
  onBack?: () => void;
  onDataChanged?: () => void;
  onUpgradePlan?: () => void;
}

interface Service {
  _id?: string;
  serviceId: string;
  serviceName: string;
  amount: number;
  serviceType: string | string[];
  gender: string | string[];
  images?: { [key: string]: string };
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

interface OriginalService {
  _id: string;
  serviceId: string;
  name: string;
  serviceType?: string[];
  serviceTypes?: string[];
  genderSupport?: string[];
  category?: string;
  image?: string;
  images?: { [key: string]: string };
}

interface ICategory {
  _id?: string;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface IMainCategory {
  _id?: string;
  mainCategoryId: string;
  mainCategoryName: string;
  mainCategoryImage?: string;
  subcategoryIds: string[];
  subcategories?: ICategory[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface IComboServiceResponse {
  _id: string;
  comboName: string;
  description: string;
  image: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  duration: string;
  genderSupport: string[];
  serviceType?: string[];
  serviceTypes?: string[];
  includedServices: {
    serviceId: string;
    serviceName: string;
    duration: string;
  }[];
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IStylistComboServiceSelection {
  _id?: string;
  comboServiceId: string | { _id?: string; toString?: () => string };
  amount?: number;
  serviceType?: string[];
  gender?: string[];
  addedAt?: string;
  updatedAt?: string;
}

interface ISelectedComboService extends IComboServiceResponse {
  stylistAmount?: number;
  stylistServiceType?: string[];
  stylistGender?: string[];
}

interface SpecialServicePlanMeta {
  limit: number;
  planLabel: string;
}

const PRIMARY_COLOR = '#FD8B36';
const BACKGROUND_COLOR = '#FFF3E8';
const TEXT_COLOR = '#1F1F1F';
const SECONDARY_TEXT_COLOR = '#6E6E6E';
const MUTED_TEXT_COLOR = '#999999';
const CARD_ACCENT = '#FFF5EE';
const GRADIENT_COLORS = ['#FD8B36', '#f7bb2c'];
const GRADIENT_LOCATIONS = [0, 0.7];
const GRADIENT_START = { x: 0.5, y: 0.5 };
const GRADIENT_END = { x: 0.5, y: 0 };
const GRADIENT_CONFIG = {
  colors: GRADIENT_COLORS,
  locations: GRADIENT_LOCATIONS,
  start: GRADIENT_START,
  end: GRADIENT_END,
};

const ADD_GENDER_FILTERS = ['Women', 'Men'] as const;
const ADD_SERVICE_TYPE_FILTERS = ['Salon', 'Home'] as const;

const resolveSpecialServicePlanMeta = (
  planName?: string | null,
  planCode?: string | null,
): SpecialServicePlanMeta => {
  const normalizedPlanName = String(planName || '').toLowerCase();
  const normalizedPlanCode = String(planCode || '').toLowerCase();
  const combined = `${normalizedPlanName} ${normalizedPlanCode}`.trim();

  if (combined.includes('elite')) {
    return {
      limit: 20,
      planLabel: planName || 'Elite Partner',
    };
  }

  if (
    combined.includes('verified') ||
    combined.includes('pro') ||
    combined.includes('plus') ||
    normalizedPlanCode === 'plus'
  ) {
    return {
      limit: 10,
      planLabel: planName || 'Verified Pro Partner',
    };
  }

  return {
    limit: 5,
    planLabel: planName || 'Freemium',
  };
};

const MyServiceScreen: React.FC<MyServiceScreenProps> = ({ userId, onBack, onDataChanged, onUpgradePlan }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [specialServiceIds, setSpecialServiceIds] = useState<Set<string>>(new Set());
  const [originalServices, setOriginalServices] = useState<OriginalService[]>([]);
  const [availableComboServices, setAvailableComboServices] = useState<IComboServiceResponse[]>([]);
  const [selectedComboServices, setSelectedComboServices] = useState<ISelectedComboService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number>(-1);
  const [isSpecialService, setIsSpecialService] = useState(false);
  const [specialServiceLimit, setSpecialServiceLimit] = useState(1);
  const [specialServicePlanLabel, setSpecialServicePlanLabel] = useState('Freemium');
  const [amount, setAmount] = useState('');
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [selectedAddGenderFilters, setSelectedAddGenderFilters] = useState<string[]>(['Women']);
  const [selectedAddServiceTypeFilters, setSelectedAddServiceTypeFilters] = useState<string[]>(['Salon']);
  const [selectedAddCategoryFilter, setSelectedAddCategoryFilter] = useState<string>('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [pendingCombo, setPendingCombo] = useState<IComboServiceResponse | null>(null);
  const [showComboPreferenceModal, setShowComboPreferenceModal] = useState(false);
  const [comboAmount, setComboAmount] = useState('');
  const [selectedComboServiceTypes, setSelectedComboServiceTypes] = useState<string[]>([]);
  const [selectedComboGenders, setSelectedComboGenders] = useState<string[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [allServices, setAllServices] = useState<OriginalService[]>([]);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [mainCategories, setMainCategories] = useState<IMainCategory[]>([]);
  const [loadingMainCategories, setLoadingMainCategories] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<IMainCategory | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<ICategory | null>(null);
  const [filteredSubcategories, setFilteredSubcategories] = useState<ICategory[]>([]);
  const [categoryServices, setCategoryServices] = useState<OriginalService[]>([]);
  const [loadingCategoryServices, setLoadingCategoryServices] = useState(false);
  const [stylistMainCategoryIds, setStylistMainCategoryIds] = useState<string[]>([]);
  const [showAllMainCategories, setShowAllMainCategories] = useState(false);

  // Use refs to track if services have been fetched (persists across re-renders)
  const servicesFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const prefetchedImageUrlsRef = useRef<Set<string>>(new Set());
  const categoriesFetchedRef = useRef(false);
  const mainCategoriesFetchedRef = useRef(false);
  const modal = useModal();

  const fetchProfileServices = async (stylistUserId: string) => {
    const profileResponse = await fetch(`${API_BASE_URL_WITH_API}/profile/${stylistUserId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!profileResponse.ok) {
      throw new Error(`Failed to fetch services: ${profileResponse.status}`);
    }

    const profileResult = await profileResponse.json();
    if (profileResult.success && profileResult.data) {
      if (profileResult.data.selectedServices) {
        setServices(profileResult.data.selectedServices);
      }
      if (Array.isArray(profileResult.data.mainCategoryIds) && profileResult.data.mainCategoryIds.length > 0) {
        setStylistMainCategoryIds(profileResult.data.mainCategoryIds.map((id: any) => String(id)));
      } else if (Array.isArray(profileResult.data.mainCategories) && profileResult.data.mainCategories.length > 0) {
        setStylistMainCategoryIds(
          profileResult.data.mainCategories
            .map((cat: any) => String(cat?.mainCategoryId || cat?._id || ''))
            .filter(Boolean),
        );
      }
    }
  };

  const fetchSpecialServices = async (stylistUserId: string) => {
    const response = await fetch(`${API_BASE_URL_WITH_API}/services/special/${stylistUserId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      setSpecialServiceIds(new Set());
      return;
    }

    const result = await response.json();
    const list = Array.isArray(result?.data) ? result.data : [];
    const ids = list
      .map((item: any) => item?.serviceId)
      .filter((id: string) => !!id);

    setSpecialServiceIds(new Set(ids));
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user's selected services
        const profileResponse = await fetch(`${API_BASE_URL_WITH_API}/profile/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!profileResponse.ok) {
          throw new Error(`Failed to fetch services: ${profileResponse.status}`);
        }

        const profileResult = await profileResponse.json();
        console.log('📋 Profile response:', JSON.stringify(profileResult, null, 2));

        if (profileResult.success && profileResult.data) {
          // Set regular selected services
          if (profileResult.data.selectedServices) {
            setServices(profileResult.data.selectedServices);
            console.log('✅ Regular services set:', profileResult.data.selectedServices.length);
          }

          // Set stylist's main categories
          if (Array.isArray(profileResult.data.mainCategoryIds) && profileResult.data.mainCategoryIds.length > 0) {
            setStylistMainCategoryIds(profileResult.data.mainCategoryIds.map((id: any) => String(id)));
          } else if (Array.isArray(profileResult.data.mainCategories) && profileResult.data.mainCategories.length > 0) {
            setStylistMainCategoryIds(
              profileResult.data.mainCategories
                .map((cat: any) => String(cat?.mainCategoryId || cat?._id || ''))
                .filter(Boolean),
            );
          }

          // Fetch selected combo services details
          console.log('🔍 Combo services array:', profileResult.data.comboServices);

          if (profileResult.data.comboServices && Array.isArray(profileResult.data.comboServices)) {
            try {
              const mergedCombos = await fetchAndMergeSelectedCombos(profileResult.data.comboServices);
              console.log('✅ Merged combo details extracted:', mergedCombos.length);
              setSelectedComboServices(mergedCombos);
            } catch (error) {
              console.error('❌ Error fetching combo service details:', error);
            }
          } else {
            console.log('ℹ️ comboServices field not found or not an array');
            setSelectedComboServices([]);
          }
        }

        // Fetch original services to get available options (only if not already fetched)
        if (!servicesFetchedRef.current && !isFetchingRef.current) {
          isFetchingRef.current = true;
          try {
            const servicesResponse = await fetch(`${API_BASE_URL_WITH_API}/services`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
            });

            if (servicesResponse.ok) {
              const servicesResult = await servicesResponse.json();
              if (servicesResult.success && servicesResult.data) {
                const servicesData = Array.isArray(servicesResult.data) ? servicesResult.data : [];
                setOriginalServices(servicesData);
                setAllServices(servicesData);
                servicesFetchedRef.current = true;
              }
            }
          } catch (error) {
            console.error('❌ Error fetching services in useEffect:', error);
          } finally {
            isFetchingRef.current = false;
          }
        }
      } catch (error) {
        console.error('❌ Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  useEffect(() => {
    const loadSpecialServices = async () => {
      if (!userId) {
        setSpecialServiceIds(new Set());
        return;
      }

      try {
        await fetchSpecialServices(userId);
      } catch (error) {
        console.error('❌ Error fetching special services:', error);
        setSpecialServiceIds(new Set());
      }
    };

    loadSpecialServices();
  }, [userId]);

  useEffect(() => {
    const fetchSpecialServicePlan = async () => {
      if (!userId) {
        setSpecialServiceLimit(1);
        setSpecialServicePlanLabel('Freemium');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/subscriptions/current/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          setSpecialServiceLimit(1);
          setSpecialServicePlanLabel('Freemium');
          return;
        }

        const result = await response.json();
        const planMeta = resolveSpecialServicePlanMeta(
          result?.data?.planName,
          result?.data?.planCode,
        );
        setSpecialServiceLimit(planMeta.limit);
        setSpecialServicePlanLabel(planMeta.planLabel);
      } catch (error) {
        console.error('❌ Error fetching special service plan:', error);
        setSpecialServiceLimit(1);
        setSpecialServicePlanLabel('Freemium');
      }
    };

    fetchSpecialServicePlan();
  }, [userId]);

  useEffect(() => {
    const fetchComboServices = async () => {
      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/combo-services?isActive=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.warn('Failed to fetch combo services');
          setAvailableComboServices([]);
          return;
        }

        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setAvailableComboServices(result.data);
          console.log('✅ Combo services fetched:', result.data.length, 'combos');
        }
      } catch (error) {
        console.error('❌ Error fetching combo services:', error);
        setAvailableComboServices([]);
      }
    };

    fetchComboServices();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      if (categoriesFetchedRef.current) {
        return;
      }

      try {
        setLoadingCategories(true);
        const response = await fetch(`${API_BASE_URL_WITH_API}/categories`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.warn('Failed to fetch categories');
          setCategories([]);
          return;
        }

        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          // Filter to only active categories
          const activeCategories = result.data.filter((cat: ICategory) => cat.isActive);
          setCategories(activeCategories);
          categoriesFetchedRef.current = true;
          console.log('✅ Categories fetched:', activeCategories.length, 'categories');
          console.log('📦 Category data:', activeCategories);
        } else {
          console.warn('❌ Categories response format unexpected:', result);
          setCategories([]);
        }
      } catch (error) {
        console.error('❌ Error fetching categories:', error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const fetchMainCategories = async () => {
    if (mainCategoriesFetchedRef.current) {
      console.warn('⏭️ Main categories already fetched, skipping request');
      return;
    }

    try {
      setLoadingMainCategories(true);
      console.warn('main CHECKPOINT: Fetching main categories...');
      const endpoint = `${API_BASE_URL_WITH_API}/main-categories`;
      console.warn('🌐 API_BASE_URL_WITH_API:', API_BASE_URL_WITH_API);
      console.warn('🔗 Fetching main categories from:', endpoint);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('❌ Failed to fetch main categories, status:', response.status);
        console.warn('📍 URL:', endpoint);
        console.warn('📝 Response:', await response.text());
        setMainCategories([]);
        return;
      }

      const result = await response.json();
      console.warn('📥 Main categories response:', result);

      if (result.success && result.data && Array.isArray(result.data.mainCategories)) {
        const activeMainCategories = result.data.mainCategories.filter(
          (mainCat: IMainCategory) => mainCat.isActive,
        );
        setMainCategories(activeMainCategories);
        mainCategoriesFetchedRef.current = true;
        console.warn('✅ Main categories fetched:', activeMainCategories.length, 'main categories');
        console.warn('📦 Main category data:', activeMainCategories);
      } else {
        console.warn('❌ Main categories response format unexpected:', result);
        setMainCategories([]);
      }
    } catch (error) {
      console.error('❌ Error fetching main categories:', error);
      setMainCategories([]);
    } finally {
      setLoadingMainCategories(false);
    }
  };

  useEffect(() => {
    fetchMainCategories();
  }, []);

  useEffect(() => {
    const urls = [
      ...services.flatMap((service) => extractServiceImageUrls(service)),
      ...allServices.flatMap((service) => extractServiceImageUrls(service)),
    ];

    if (urls.length > 0) {
      prefetchImageUrls(urls);
    }
  }, [services, allServices]);

  // Sort services to show special services first
  const sortedServices = useMemo(() => {
    if (services.length === 0) return [];

    const special = services.filter(service => specialServiceIds.has(service.serviceId));
    const regular = services.filter(service => !specialServiceIds.has(service.serviceId));

    return [...special, ...regular];
  }, [services, specialServiceIds]);

  const currentServiceId = editingService?.serviceId || pendingServiceId || '';
  const isCurrentServiceAlreadySpecial = currentServiceId
    ? specialServiceIds.has(currentServiceId)
    : false;
  const hasReachedSpecialServiceLimit =
    specialServiceIds.size >= specialServiceLimit && !isCurrentServiceAlreadySpecial;
  const projectedSpecialServiceCount = isCurrentServiceAlreadySpecial
    ? specialServiceIds.size - (isSpecialService ? 0 : 1)
    : specialServiceIds.size + (isSpecialService ? 1 : 0);

  const getServiceTypeIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'Salon':
        return 'store';
      case 'At Home':
        return 'home';
      case 'Both':
        return 'swap-horiz';
      default:
        return 'room-service';
    }
  };

  const normalizeServiceTypes = (service?: Partial<OriginalService>): string[] => {
    if (!service) return [];

    let rawTypes: string[] = [];

    // Try different property names
    if (Array.isArray(service.serviceType)) {
      rawTypes = service.serviceType;
    } else if (Array.isArray(service.serviceTypes)) {
      rawTypes = service.serviceTypes;
    } else if ((service as any).serviceType && Array.isArray((service as any).serviceType)) {
      rawTypes = (service as any).serviceType;
    } else if ((service as any).serviceTypes && Array.isArray((service as any).serviceTypes)) {
      rawTypes = (service as any).serviceTypes;
    }

    // If no types found, try to look for any array that contains 'Salon' or 'Home'
    if (rawTypes.length === 0) {
      for (const key in service) {
        if (Array.isArray((service as any)[key])) {
          const arr = (service as any)[key];
          if (arr.some((item: any) => item === 'Salon' || item === 'Home' || item === 'At Home')) {
            rawTypes = arr;
            console.log('🔍 Found service types in alternate field:', key, '- Value:', rawTypes);
            break;
          }
        }
      }
    }

    const normalized = [...new Set(rawTypes)]
      .map((type) => (type === 'Home' || type === 'At Home' ? 'At Home' : type))
      .filter((type) => type === 'At Home' || type === 'Salon');

    // console.log('🔍 Service types normalized for:', (service as any).name || (service as any).serviceName, '- Raw:', rawTypes, '- Normalized:', normalized);

    return normalized;
  };

  const normalizeGenders = (service?: Partial<OriginalService>): string[] => {
    if (!service) return [];

    let genderArray: string[] = [];

    // Check multiple possible property names for gender/genderSupport
    if (Array.isArray(service.genderSupport)) {
      genderArray = service.genderSupport;
    } else if (Array.isArray((service as any).gender)) {
      genderArray = (service as any).gender;
    } else if (Array.isArray((service as any).genders)) {
      genderArray = (service as any).genders;
    } else if ((service as any).genderSupport && Array.isArray((service as any).genderSupport)) {
      genderArray = (service as any).genderSupport;
    }

    // If no genders found, try to look for any array that contains 'Male' or 'Female'
    if (genderArray.length === 0) {
      for (const key in service) {
        if (Array.isArray((service as any)[key])) {
          const arr = (service as any)[key];
          if (arr.some((item: any) => item === 'Male' || item === 'Female' || item === 'male' || item === 'female')) {
            genderArray = arr;
            console.log('🔍 Found genders in alternate field:', key, '- Value:', genderArray);
            break;
          }
        }
      }
    }

    const normalized = [...new Set(genderArray)]
      .map((g) => g === 'male' ? 'Male' : g === 'female' ? 'Female' : g)
      .filter((g) => g === 'Male' || g === 'Female');

    // console.log('🔍 Genders normalized for:', (service as any).name || (service as any).serviceName, '- Raw:', genderArray, '- Normalized:', normalized);

    return normalized;
  };

  const normalizeComboServiceTypes = (combo?: Partial<IComboServiceResponse>): string[] => {
    if (!combo) return [];
    const rawTypes = Array.isArray(combo.serviceTypes)
      ? combo.serviceTypes
      : Array.isArray(combo.serviceType)
        ? combo.serviceType
        : [];

    return [...new Set(rawTypes)]
      .map((type) => (type === 'Home' || type === 'At Home' ? 'At Home' : type))
      .filter((type) => type === 'Salon' || type === 'At Home');
  };

  const normalizeComboGenders = (genders?: string[]): string[] => {
    if (!Array.isArray(genders)) return [];
    return [...new Set(genders)]
      .map((gender) => (gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender))
      .filter((gender) => gender === 'Male' || gender === 'Female');
  };

  const extractServiceImageUrls = (service?: Partial<OriginalService | Service>): string[] => {
    if (!service || !service.images || typeof service.images !== 'object') {
      return [];
    }

    const imageValues = Object.values(service.images)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => toCloudFrontUrl(value))
      .filter((value) => !!value);

    return [...new Set(imageValues)];
  };

  const getServiceName = (service: any): string => {
    // Try different property names for service name
    if (service?.name && typeof service.name === 'string') {
      return service.name;
    }
    if (service?.serviceName && typeof service.serviceName === 'string') {
      return service.serviceName;
    }
    // Fallback to unknown
    console.warn('⚠️ Service name not found in:', service);
    return 'Unknown Service';
  };

  async function prefetchImageUrls(urls: string[]) {
    const freshUrls = urls.filter((url) => url && !prefetchedImageUrlsRef.current.has(url));
    if (freshUrls.length === 0) return;

    freshUrls.forEach((url) => prefetchedImageUrlsRef.current.add(url));

    try {
      await Promise.allSettled(freshUrls.map((url) => Image.prefetch(url)));
    } catch (error) {
      console.error('❌ Error prefetching service images:', error);
    }
  }

  const mapAddGenderFilterToBackend = (filter: string): string =>
    filter === 'Men' ? 'Male' : 'Female';

  const mapAddServiceTypeFilterToBackend = (filter: string): string =>
    filter === 'Home' ? 'At Home' : 'Salon';

  const matchesAddFilters = (serviceTypes: string[], genders: string[], category?: string): boolean => {
    const normalizedTypes = serviceTypes.map((type) =>
      type === 'Home' || type === 'At Home' ? 'At Home' : type,
    );
    const normalizedGenders = genders.map((gender) =>
      gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender,
    );

    const matchesType =
      selectedAddServiceTypeFilters.length === 0 ||
      selectedAddServiceTypeFilters.some((filter) =>
        normalizedTypes.includes(mapAddServiceTypeFilterToBackend(filter)),
      );

    const matchesGender =
      selectedAddGenderFilters.length === 0 ||
      selectedAddGenderFilters.some((filter) =>
        normalizedGenders.includes(mapAddGenderFilterToBackend(filter)),
      );

    const matchesCategory =
      !selectedAddCategoryFilter ||
      selectedAddCategoryFilter === '' ||
      category === selectedAddCategoryFilter;

    return matchesType && matchesGender && matchesCategory;
  };

  async function fetchAndMergeSelectedCombos(
    profileComboServices: IStylistComboServiceSelection[],
  ): Promise<ISelectedComboService[]> {
    if (!Array.isArray(profileComboServices) || profileComboServices.length === 0) {
      return [];
    }

    const comboPreferencesMap = new Map<
      string,
      { amount?: number; serviceType: string[]; gender: string[] }
    >();

    profileComboServices.forEach((comboItem) => {
      const comboServiceIdValue = comboItem.comboServiceId;
      const comboId =
        typeof comboServiceIdValue === 'string'
          ? comboServiceIdValue
          : comboServiceIdValue?._id
            ? String(comboServiceIdValue._id)
            : typeof comboServiceIdValue?.toString === 'function'
              ? comboServiceIdValue.toString()
              : '';
      if (!comboId) return;
      comboPreferencesMap.set(comboId, {
        amount: comboItem.amount,
        serviceType: normalizeComboServiceTypes({
          serviceType: comboItem.serviceType,
          serviceTypes: comboItem.serviceType,
        }),
        gender: normalizeComboGenders(comboItem.gender),
      });
    });

    const comboIds = Array.from(comboPreferencesMap.keys());
    if (comboIds.length === 0) return [];

    const comboDetailsPromises = comboIds.map((comboId: string) =>
      fetch(`${API_BASE_URL_WITH_API}/combo-services/${comboId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })
        .then((res) => (res.ok ? res.json() : null))
        .catch((err) => {
          console.error(`❌ Error fetching combo ${comboId}:`, err);
          return null;
        })
    );

    const comboResults = await Promise.all(comboDetailsPromises);
    return comboResults
      .filter((result) => result?.success && result?.data)
      .map((result) => {
        const comboData = result.data as IComboServiceResponse;
        const prefs = comboPreferencesMap.get(comboData._id);
        return {
          ...comboData,
          stylistAmount: prefs?.amount,
          stylistServiceType: prefs?.serviceType || [],
          stylistGender: prefs?.gender || [],
        };
      });
  }

  const getGenderIcon = (gender: string) => {
    switch (gender) {
      case 'Male':
        return 'male';
      case 'Female':
        return 'female';
      case 'Both':
        return 'people';
      default:
        return 'person';
    }
  };

  const formatServiceType = (type: string | string[]): string => {
    if (Array.isArray(type)) {
      return type.join(', ');
    }
    return type;
  };

  const formatGender = (gender: string | string[]): string => {
    if (Array.isArray(gender)) {
      return gender.join(', ');
    }
    return gender;
  };

  // Get service initials (first letter of each word, max 2 letters)
  const getServiceInitials = (serviceName: string): string => {
    const words = serviceName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return serviceName.substring(0, 2).toUpperCase();
  };

  // Get background color based on service type
  const getServiceAvatarColor = (serviceType: string | string[]): string => {
    const types = Array.isArray(serviceType) ? serviceType : [serviceType];
    if (types.includes('Salon')) {
      return '#E3F2FD'; // Light blue for Salon
    } else if (types.includes('At Home') || types.includes('Home')) {
      return '#F3E5F5'; // Light purple for Home
    } else if (types.includes('Both')) {
      return '#FFF3E0'; // Light orange for Both
    }
    return '#FFF5F0'; // Default light orange
  };

  // Get text color based on service type
  const getServiceAvatarTextColor = (serviceType: string | string[]): string => {
    const types = Array.isArray(serviceType) ? serviceType : [serviceType];
    if (types.includes('Salon')) {
      return '#1976D2'; // Blue for Salon
    } else if (types.includes('At Home') || types.includes('Home')) {
      return '#7B1FA2'; // Purple for Home
    } else if (types.includes('Both')) {
      return '#F57C00'; // Orange for Both
    }
    return '#FD8B36'; // Default orange
  };

  // Get service image based on gender
  const getServiceImage = (service: Service): string | null => {
    if (!service.images || typeof service.images !== 'object') {
      return null;
    }

    const genders = Array.isArray(service.gender) ? service.gender : [service.gender];

    // If only one gender, return that image
    if (genders.length === 1) {
      const gender = genders[0];
      // Try exact match first
      if (service.images[gender]) {
        return toCloudFrontUrl(service.images[gender]);
      }
      // Try case-insensitive match
      const imageKeys = Object.keys(service.images);
      const matchingKey = imageKeys.find(key => {
        const keyLower = key.toLowerCase();
        const genderLower = gender.toLowerCase();
        return keyLower === genderLower ||
          (keyLower === 'male' && genderLower === 'male') ||
          (keyLower === 'female' && genderLower === 'female');
      });
      if (matchingKey && service.images[matchingKey]) {
        return toCloudFrontUrl(service.images[matchingKey]);
      }
    }

    // If both genders, return null (will be handled by rotating component)
    if (genders.length === 2 && (genders.includes('Male') && genders.includes('Female'))) {
      return null; // Will use rotating images
    }

    return null;
  };

  // Get images for both genders (for rotation)
  const getServiceImagesForRotation = (service: Service): string[] => {
    if (!service.images || typeof service.images !== 'object') {
      return [];
    }

    const genders = Array.isArray(service.gender) ? service.gender : [service.gender];
    const images: string[] = [];

    if (genders.includes('Male')) {
      const maleImage = service.images['Male'] ||
        service.images['male'] ||
        service.images['Men'] ||
        service.images['men'];
      if (maleImage) images.push(toCloudFrontUrl(maleImage));
    }

    if (genders.includes('Female')) {
      const femaleImage = service.images['Female'] ||
        service.images['female'] ||
        service.images['Women'] ||
        service.images['women'];
      if (femaleImage) images.push(toCloudFrontUrl(femaleImage));
    }

    return images;
  };

  // Component for rotating images
  const RotatingServiceImage: React.FC<{ service: Service; size?: number }> = ({ service, size = 60 }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const images = getServiceImagesForRotation(service);
    const genders = Array.isArray(service.gender) ? service.gender : [service.gender];
    const isBothGenders = genders.length === 2 && genders.includes('Male') && genders.includes('Female');

    useEffect(() => {
      if (isBothGenders && images.length >= 2) {
        const interval = setInterval(() => {
          setCurrentImageIndex((prev) => (prev + 1) % images.length);
        }, 2000); // Change every 2 seconds

        return () => clearInterval(interval);
      }
    }, [isBothGenders, images.length]);

    // If single gender or no images, show static image or initials
    if (!isBothGenders || images.length < 2) {
      const singleImage = getServiceImage(service);
      if (singleImage) {
        return (
          <Image
            source={{ uri: toCloudFrontUrl(singleImage) }}
            style={[styles.serviceImage, { width: size, height: size, borderRadius: size / 2 }]}
            resizeMode="cover"
            fadeDuration={0}
          />
        );
      }
      // Fallback to initials
      return (
        <View style={[
          styles.serviceIconContainer,
          { backgroundColor: getServiceAvatarColor(service.serviceType), width: size, height: size, borderRadius: size / 2 }
        ]}>
          <Text style={[
            styles.serviceInitials,
            { color: getServiceAvatarTextColor(service.serviceType), fontSize: size * 0.33 }
          ]}>
            {getServiceInitials(service.serviceName)}
          </Text>
        </View>
      );
    }

    // Rotating images for both genders
    if (images.length >= 2 && currentImageIndex < images.length) {
      return (
        <Image
          source={{ uri: toCloudFrontUrl(images[currentImageIndex]) }}
          style={[styles.serviceImage, { width: size, height: size, borderRadius: size / 2 }]}
          resizeMode="cover"
          fadeDuration={0}
        />
      );
    }

    // Fallback to initials if no images
    return (
      <View style={[
        styles.serviceIconContainer,
        { backgroundColor: getServiceAvatarColor(service.serviceType), width: size, height: size, borderRadius: size / 2 }
      ]}>
        <Text style={[
          styles.serviceInitials,
          { color: getServiceAvatarTextColor(service.serviceType), fontSize: size * 0.33 }
        ]}>
          {getServiceInitials(service.serviceName)}
        </Text>
      </View>
    );
  };

  const handleEdit = async (service: Service, index: number) => {
    // Ensure we have backend services loaded before editing (only fetch if not already cached)
    if (!servicesFetchedRef.current && allServices.length === 0 && !isFetchingRef.current) {
      setLoadingServices(true);
      isFetchingRef.current = true;
      try {
        const servicesResponse = await fetch(`${API_BASE_URL_WITH_API}/services`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (servicesResponse.ok) {
          const servicesResult = await servicesResponse.json();
          if (servicesResult.success && servicesResult.data) {
            const servicesData = Array.isArray(servicesResult.data) ? servicesResult.data : [];
            setAllServices(servicesData);
            setOriginalServices(servicesData);
            servicesFetchedRef.current = true; // Mark as fetched
          }
        }
      } catch (error) {
        console.error('❌ Error fetching services for edit:', error);
      } finally {
        setLoadingServices(false);
        isFetchingRef.current = false;
      }
    }

    setEditingService(service);
    setEditingServiceIndex(index);
    setAmount(service.amount.toString());

    // Convert serviceType and gender to arrays if they're strings
    const serviceTypes = Array.isArray(service.serviceType)
      ? service.serviceType
      : [service.serviceType];
    const genders = Array.isArray(service.gender)
      ? service.gender
      : [service.gender];

    setSelectedServiceTypes(serviceTypes);
    setSelectedGenders(genders);
    setIsSpecialService(specialServiceIds.has(service.serviceId));
    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditingService(null);
    setEditingServiceIndex(-1);
    setAmount('');
    setSelectedServiceTypes([]);
    setSelectedGenders([]);
    setIsSpecialService(false);
  };

  const handleCloseAddServiceModal = () => {
    setShowAddServiceModal(false);
    setPendingServiceId(null);
    setAmount('');
    setSelectedServiceTypes([]);
    setSelectedGenders([]);
    setSelectedAddGenderFilters(['Women']);
    setSelectedAddServiceTypeFilters(['Salon']);
    setSelectedAddCategoryFilter('');
    setSelectedMainCategory(null);
    setSelectedSubcategory(null);
    setFilteredSubcategories([]);
    setCategoryServices([]);
    setIsSpecialService(false);
  };

  const toggleAddGenderFilter = (filter: string) => {
    setSelectedAddGenderFilters((current) => {
      if (current.includes(filter)) {
        return current.length === 1 ? current : [filter];
      }
      return [filter];
    });
  };

  const toggleAddServiceTypeFilter = (filter: string) => {
    setSelectedAddServiceTypeFilters((current) => {
      if (current.includes(filter)) {
        return current.length === 1 ? current : [filter];
      }
      return [filter];
    });
  };

  const getAvailableCategories = (): ICategory[] => {
    return categories;
  };

  const matchesGenderAndServiceTypeFilters = (serviceTypes: string[], genders: string[]): boolean => {
    const normalizedTypes = serviceTypes.map((type) =>
      type === 'Home' || type === 'At Home' ? 'At Home' : type,
    );
    const normalizedGenders = genders.map((gender) =>
      gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender,
    );

    const matchesType =
      selectedAddServiceTypeFilters.length === 0 ||
      selectedAddServiceTypeFilters.some((filter) =>
        normalizedTypes.includes(mapAddServiceTypeFilterToBackend(filter)),
      );

    const matchesGender =
      selectedAddGenderFilters.length === 0 ||
      selectedAddGenderFilters.some((filter) =>
        normalizedGenders.includes(mapAddGenderFilterToBackend(filter)),
      );

    const result = matchesType && matchesGender;
    // Uncomment for detailed logging:
    // console.log('🔎 Filter check - ServiceTypes:', normalizedTypes, 'Genders:', normalizedGenders, 'Result:', result);
    return result;
  };

  const toggleAddCategoryFilter = (category: string) => {
    if (selectedAddCategoryFilter === category) {
      setSelectedAddCategoryFilter('');
    } else {
      setSelectedAddCategoryFilter(category);
    }
  };

  const renderFilterChip = (
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => {
    if (selected) {
      return (
        <TouchableOpacity
          key={label}
          style={styles.filterChipWrapper}
          onPress={onPress}
          activeOpacity={0.85}>
          <LinearGradient {...GRADIENT_CONFIG} style={styles.filterChipSelected}>
            <Text style={styles.filterChipTextSelected}>{label}</Text>
          </LinearGradient>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={label}
        style={styles.filterChip}
        onPress={onPress}
        activeOpacity={0.75}>
        <Text style={styles.filterChipText}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const handleOpenAddServiceModal = async () => {
    setSelectedAddGenderFilters(['Women']);
    setSelectedAddServiceTypeFilters(['Salon']);
    setSelectedAddCategoryFilter('');
    setSelectedMainCategory(null);
    setSelectedSubcategory(null);
    setFilteredSubcategories([]);
    setShowAllMainCategories(false);
    console.warn('🪟 Opening Add Service modal');
    await fetchMainCategories();
    setShowAddServiceModal(true);

    // Only fetch if services haven't been fetched yet
    if (servicesFetchedRef.current && allServices.length > 0) {
      // Services already loaded, no need to fetch again
      console.log('✅ Using cached services:', allServices.length);
      return;
    }

    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      console.log('⏳ Services fetch already in progress...');
      return;
    }

    setLoadingServices(true);
    isFetchingRef.current = true;

    try {
      const servicesResponse = await fetch(`${API_BASE_URL_WITH_API}/services`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      console.log('📥 Fetching services for add modal...');
      if (servicesResponse.ok) {
        const servicesResult = await servicesResponse.json();
        console.log('✅ Services fetched for add modal:', servicesResult);
        if (servicesResult.success && servicesResult.data) {
          const servicesData = Array.isArray(servicesResult.data) ? servicesResult.data : [];
          console.log('📦 Services data:', servicesData.length, 'services');

          // Log first few services to check if they have categories
          if (servicesData.length > 0) {
            console.log('📝 First service structure:', servicesData[0]);
            const servicesWithCategory = servicesData.filter((s: any) => s.category);
            console.log('📊 Services with category field:', servicesWithCategory.length, 'out of', servicesData.length);
            if (servicesWithCategory.length > 0) {
              console.log('✅ Sample service with category:', servicesWithCategory[0]);
            }
          }

          setAllServices(servicesData);
          setOriginalServices(servicesData);
          servicesFetchedRef.current = true; // Mark as fetched
        }
      } else {
        const errorText = await servicesResponse.text();
        console.error('❌ Failed to fetch services:', errorText);
      }
    } catch (error) {
      console.error('❌ Error fetching services:', error);
    } finally {
      setLoadingServices(false);
      isFetchingRef.current = false;
    }
  };

  const fetchServicesByCategory = async (categoryId: string) => {
    try {
      setLoadingCategoryServices(true);
      const endpoint = `${API_BASE_URL_WITH_API}/categories/${categoryId}/services`;
      console.log('🔗 Fetching services for category:', categoryId);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('❌ Failed to fetch services for category, status:', response.status);
        setCategoryServices([]);
        return;
      }

      const result = await response.json();
      console.log('📥 Category services response:', result);

      if (result.success && result.data && Array.isArray(result.data.services)) {
        setCategoryServices(result.data.services);
        console.log('✅ Services fetched for category:', result.data.services.length, 'services');
      } else if (result.success && Array.isArray(result.data)) {
        // Handle case where data is directly an array
        setCategoryServices(result.data);
        console.log('✅ Services fetched for category:', result.data.length, 'services');
      } else {
        console.warn('❌ Services response format unexpected:', result);
        setCategoryServices([]);
      }
    } catch (error) {
      console.error('❌ Error fetching services for category:', error);
      setCategoryServices([]);
    } finally {
      setLoadingCategoryServices(false);
    }
  };

  const getMainCategorySubcategories = (mainCategory: IMainCategory): ICategory[] => {
    const directSubcategories = (mainCategory.subcategories || []).filter(
      (cat) => cat.isActive !== false,
    );

    if (directSubcategories.length > 0) {
      const uniqueSubcategories = new Map<string, ICategory>();
      directSubcategories.forEach((cat) => {
        uniqueSubcategories.set(cat.categoryId || cat._id || cat.categoryName, cat);
      });
      return Array.from(uniqueSubcategories.values());
    }

    const subcategoryIds = new Set((mainCategory.subcategoryIds || []).map(String));
    return categories.filter((cat) => {
      if (cat.isActive === false) {
        return false;
      }

      return [cat.categoryId, cat._id]
        .filter(Boolean)
        .some((id) => subcategoryIds.has(String(id)));
    });
  };

  const getMainCategorySubcategoryCount = (mainCategory: IMainCategory): number => {
    const exactCount = getMainCategorySubcategories(mainCategory).length;
    if (exactCount > 0) {
      return exactCount;
    }

    return new Set(mainCategory.subcategoryIds || []).size;
  };

  const handleSelectMainCategory = (mainCategory: IMainCategory) => {
    setSelectedMainCategory(mainCategory);
    setSelectedSubcategory(null);

    // Filter subcategories from the selected main category
    const filtered = getMainCategorySubcategories(mainCategory);
    setFilteredSubcategories(filtered);

    console.log('📂 Selected main category:', mainCategory.mainCategoryName);
    console.log('📋 Filtered subcategories:', filtered.length);
  };

  const handleSelectSubcategory = (subcategory: ICategory) => {
    setSelectedSubcategory(subcategory);
    setSelectedAddCategoryFilter(subcategory.categoryName);

    // Fetch services for this category
    fetchServicesByCategory(subcategory.categoryId);

    console.log('📍 Selected subcategory:', subcategory.categoryName);
  };

  const handleResetCategorySelection = () => {
    setSelectedMainCategory(null);
    setSelectedSubcategory(null);
    setFilteredSubcategories([]);
    setSelectedAddCategoryFilter('');
    setCategoryServices([]);
  };

  const handleSelectService = (service: OriginalService) => {
    const normalizedServiceTypes = normalizeServiceTypes(service);
    const normalizedGenders = normalizeGenders(service);
    const selectedServiceName = getServiceName(service);

    // Use serviceId from API response (this is the correct field to save)
    setPendingServiceId(service.serviceId);
    setAmount('');
    // Pre-populate with first available options from backend (user can change)
    setSelectedServiceTypes(normalizedServiceTypes.length > 0 ? [normalizedServiceTypes[0]] : []);
    setSelectedGenders(normalizedGenders.length > 0 ? [normalizedGenders[0]] : []);
    // Create a temporary service object for editing
    setEditingService({
      serviceId: service.serviceId,
      serviceName: selectedServiceName,
      amount: 0,
      serviceType: [],
      gender: [],
    });
    setEditingServiceIndex(-1); // -1 indicates new service
    setIsSpecialService(false);
    setShowAddServiceModal(false);
    setShowEditModal(true);
  };

  const handleSaveNewService = async () => {
    if (!pendingServiceId || !userId || !editingService) {
      return;
    }

    // Validate amount
    if (!amount || amount.trim() === '') {
      modal.showAlert('Error', 'Please enter an amount', 'error');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      modal.showAlert('Error', 'Please enter a valid amount', 'error');
      return;
    }

    // Validate service types
    if (selectedServiceTypes.length === 0) {
      modal.showAlert('Error', 'Please select at least one service type', 'error');
      return;
    }

    // Validate genders
    if (selectedGenders.length === 0) {
      modal.showAlert('Error', 'Please select at least one gender', 'error');
      return;
    }

    try {
      setSaving(true);

      const apiUrl = `${API_BASE_URL_WITH_API}/services/save`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userId,
          serviceId: pendingServiceId,
          amount: amountNum,
          serviceType: selectedServiceTypes,
          gender: selectedGenders,
          serviceName: editingService.serviceName,
          isSpecialService,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => null);
        throw new Error(errorResult?.message || `Failed to save service: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Service saved successfully:', result);

      await Promise.all([
        fetchProfileServices(userId),
        fetchSpecialServices(userId),
      ]);
      onDataChanged?.();

      modal.showAlert('Success', 'Service added successfully!', 'success');

      // Invalidate cache so next time modal opens, it will fetch fresh data
      // This ensures the available services list is updated (removes the newly added service)
      servicesFetchedRef.current = false;

      handleCloseModal();
    } catch (error) {
      console.error('❌ Error saving service:', error);
      modal.showAlert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to save service. Please try again.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editingService || !userId) {
      return;
    }

    // If editingServiceIndex is -1, it's a new service
    if (editingServiceIndex === -1) {
      await handleSaveNewService();
      return;
    }

    // Validate amount
    if (!amount || amount.trim() === '') {
      modal.showAlert('Error', 'Please enter an amount', 'error');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      modal.showAlert('Error', 'Please enter a valid amount', 'error');
      return;
    }

    // Validate service types
    if (selectedServiceTypes.length === 0) {
      modal.showAlert('Error', 'Please select at least one service type', 'error');
      return;
    }

    // Validate genders
    if (selectedGenders.length === 0) {
      modal.showAlert('Error', 'Please select at least one gender', 'error');
      return;
    }

    try {
      setSaving(true);

      const apiUrl = `${API_BASE_URL_WITH_API}/services/save`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userId,
          serviceId: editingService.serviceId,
          amount: amountNum,
          serviceType: selectedServiceTypes,
          gender: selectedGenders,
          serviceName: editingService.serviceName,
          isSpecialService,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => null);
        throw new Error(errorResult?.message || `Failed to update service: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Service updated successfully:', result);

      await Promise.all([
        fetchProfileServices(userId),
        fetchSpecialServices(userId),
      ]);
      onDataChanged?.();

      modal.showAlert('Success', 'Service updated successfully!', 'success');

      // Note: We don't invalidate cache here because backend services list hasn't changed
      // Only the user's selected services have changed, which we already refresh

      handleCloseModal();
    } catch (error) {
      // console.error('❌ Error updating service:', error);
      modal.showAlert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to update service. Please try again.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (index: number) => {
    modal.showConfirm(
      'Delete Service',
      'Are you sure you want to remove this service?',
      async () => {
        const serviceToDelete = services[index];
        if (!serviceToDelete?.serviceId || !userId) {
          modal.showAlert('Error', 'Unable to delete service', 'error');
          return;
        }

        try {
          setSaving(true);
          const response = await fetch(`${API_BASE_URL_WITH_API}/services/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              userId,
              serviceId: serviceToDelete.serviceId,
            }),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(errorBody || 'Failed to delete service');
          }

          // Update local state immediately after backend success
          setServices((prev) => prev.filter((_, i) => i !== index));
          setSpecialServiceIds((prev) => {
            const next = new Set(prev);
            next.delete(serviceToDelete.serviceId);
            return next;
          });
          onDataChanged?.();

          // Invalidate cache so deleted service appears in add modal list
          servicesFetchedRef.current = false;

          modal.showAlert('Success', 'Service removed successfully!', 'success');
        } catch (error) {
          console.error('❌ Error deleting service:', error);
          modal.showAlert(
            'Error',
            error instanceof Error ? error.message : 'Failed to remove service',
            'error'
          );
        } finally {
          setSaving(false);
        }
      }
    );
  };

  const handleDeleteCombo = (combo: IComboServiceResponse) => {
    modal.showConfirm(
      'Delete Combo Service',
      `Are you sure you want to remove ${combo.comboName}?`,
      async () => {
        if (!userId) {
          modal.showAlert('Error', 'User ID not found', 'error');
          return;
        }

        try {
          setSaving(true);
          const response = await fetch(
            `${API_BASE_URL_WITH_API}/profile/${userId}/combo-services/${combo._id}`,
            {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
            },
          );

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(errorBody || 'Failed to delete combo service');
          }

          // Remove from selected combo list locally after backend success
          setSelectedComboServices((prev) => prev.filter((c) => c._id !== combo._id));
          servicesFetchedRef.current = false;
          onDataChanged?.();

          modal.showAlert('Success', 'Combo service removed successfully!', 'success');
        } catch (error) {
          console.error('❌ Error deleting combo service:', error);
          modal.showAlert(
            'Error',
            error instanceof Error ? error.message : 'Failed to remove combo service',
            'error'
          );
        } finally {
          setSaving(false);
        }
      },
    );
  };

  const handleSelectCombo = (combo: IComboServiceResponse) => {
    // Check if combo is already selected
    const isAlreadySelected = selectedComboServices.some(c => c._id === combo._id);

    if (isAlreadySelected) {
      modal.showAlert('Info', `${combo.comboName} is already added to your services!`, 'info');
      return;
    }

    setPendingCombo(combo);
    setComboAmount(String(combo.discountedPrice || ''));
    setSelectedComboServiceTypes(normalizeComboServiceTypes(combo));
    setSelectedComboGenders((combo.genderSupport || [])
      .map((gender) => (gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender))
      .filter((gender, index, arr) => (gender === 'Male' || gender === 'Female') && arr.indexOf(gender) === index));
    setShowAddServiceModal(false);
    setShowComboPreferenceModal(true);
  };

  const handleCloseComboPreferenceModal = () => {
    setShowComboPreferenceModal(false);
    setPendingCombo(null);
    setComboAmount('');
    setSelectedComboServiceTypes([]);
    setSelectedComboGenders([]);
  };

  const handleSaveComboWithPreferences = async () => {
    if (!pendingCombo) {
      return;
    }

    if (!comboAmount || comboAmount.trim() === '') {
      modal.showAlert('Error', 'Please enter an amount', 'error');
      return;
    }

    const amountNum = parseFloat(comboAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      modal.showAlert('Error', 'Please enter a valid amount', 'error');
      return;
    }

    if (selectedComboServiceTypes.length === 0) {
      modal.showAlert('Error', 'Please select at least one service type', 'error');
      return;
    }

    if (selectedComboGenders.length === 0) {
      modal.showAlert('Error', 'Please select at least one gender', 'error');
      return;
    }

    await handleAddComboToProfile(
      pendingCombo,
      amountNum,
      selectedComboServiceTypes,
      selectedComboGenders
    );
  };

  const handleAddComboToProfile = async (
    combo: IComboServiceResponse,
    amountForIncludedServices?: number,
    serviceTypesForIncludedServices?: string[],
    gendersForIncludedServices?: string[]
  ) => {
    if (!userId) {
      modal.showAlert('Error', 'User ID not found', 'error');
      return;
    }

    try {
      setSaving(true);

      // Call backend API to add combo service ID to stylist's profile
      const response = await fetch(`${API_BASE_URL_WITH_API}/profile/${userId}/combo-services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          comboServiceId: combo._id,
          amount: amountForIncludedServices,
          serviceType: serviceTypesForIncludedServices,
          gender: gendersForIncludedServices,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorResult = JSON.parse(errorText);
          // Check for duplicate error from backend
          if (errorResult.message && errorResult.message.includes('already added')) {
            modal.showAlert('Info', `${combo.comboName} is already added to your services!`, 'info');
            return;
          }
        } catch (e) {
          // If not JSON, treat as generic error
        }

        // Fallback: If endpoint doesn't exist, add to local services with combo flag
        console.warn('⚠️ Combo save endpoint not available, using fallback');
        const newComboService: Service = {
          _id: combo._id,
          serviceId: combo._id,
          serviceName: combo.comboName,
          amount: combo.discountedPrice,
          serviceType: normalizeComboServiceTypes(combo),
          gender: combo.genderSupport || [],
        };
        setServices([...services, newComboService]);
        onDataChanged?.();
        modal.showAlert('Success', `${combo.comboName} added!`, 'success');
        handleCloseComboPreferenceModal();
        return;
      }

      const result = await response.json();

      if (result.success) {
        if (
          typeof amountForIncludedServices === 'number' &&
          serviceTypesForIncludedServices &&
          serviceTypesForIncludedServices.length > 0 &&
          gendersForIncludedServices &&
          gendersForIncludedServices.length > 0 &&
          Array.isArray(combo.includedServices) &&
          combo.includedServices.length > 0
        ) {
          const saveIncludedServicePromises = combo.includedServices.map((serviceItem) =>
            fetch(`${API_BASE_URL_WITH_API}/services/save`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                userId,
                serviceId: serviceItem.serviceId,
                amount: amountForIncludedServices,
                serviceType: serviceTypesForIncludedServices,
                gender: gendersForIncludedServices,
                serviceName: serviceItem.serviceName,
              }),
            })
          );

          const includedServiceResponses = await Promise.all(saveIncludedServicePromises);
          const hasIncludedSaveFailure = includedServiceResponses.some((res) => !res.ok);
          if (hasIncludedSaveFailure) {
            throw new Error('Combo added, but failed to save preferences for included services');
          }
        }

        // Refresh services list to get updated combo services
        const profileResponse = await fetch(`${API_BASE_URL_WITH_API}/profile/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (profileResponse.ok) {
          const profileResult = await profileResponse.json();
          if (profileResult.success && profileResult.data) {
            // Update services to include combo service details
            if (profileResult.data.selectedServices) {
              setServices(profileResult.data.selectedServices);
            }
            if (profileResult.data.comboServices) {
              const mergedCombos = await fetchAndMergeSelectedCombos(profileResult.data.comboServices);
              setSelectedComboServices(mergedCombos);
              console.log('✅ Combo services updated:', profileResult.data.comboServices);
            }
          }
        }

        modal.showAlert('Success', `${combo.comboName} added to your services!`, 'success');
        console.log('✅ Combo service added to profile:', combo.comboName);
        onDataChanged?.();
        handleCloseComboPreferenceModal();
      } else {
        throw new Error(result.message || 'Failed to add combo service');
      }
    } catch (error) {
      console.error('❌ Error adding combo service:', error);

      modal.showAlert(
        'Error',
        error instanceof Error ? error.message : 'Failed to add combo service',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  // Get available options for the editing service from backend
  const getAvailableOptions = () => {
    if (!editingService) {
      return { serviceTypes: [], genders: [] };
    }

    // Always fetch from backend service data
    const originalService = allServices.find(
      (s) => s.serviceId === editingService.serviceId
    );

    if (originalService) {
      return {
        serviceTypes: normalizeServiceTypes(originalService),
        genders: normalizeGenders(originalService),
      };
    }

    // If not found in allServices, try originalServices
    const fallbackService = originalServices.find(
      (s) => s.serviceId === editingService.serviceId
    );

    if (fallbackService) {
      return {
        serviceTypes: normalizeServiceTypes(fallbackService),
        genders: normalizeGenders(fallbackService),
      };
    }

    // Last resort: return empty arrays (should not happen if backend data is correct)
    console.warn('⚠️ Service not found in backend data:', editingService.serviceId);
    return {
      serviceTypes: [],
      genders: [],
    };
  };

  // Get available services (not already selected) - fetch from backend
  const getAvailableServices = () => {
    const selectedServiceIds = new Set(services.map((s) => s.serviceId));
    // Use allServices if available, otherwise fallback to originalServices
    const servicesToFilter = allServices.length > 0 ? allServices : originalServices;
    // Filter using serviceId from API (not _id)
    return servicesToFilter.filter((s) => !selectedServiceIds.has(s.serviceId));
  };

  // Use useMemo to recompute when dependencies change
  const availableOptions = useMemo(() => {
    const options = getAvailableOptions();

    return options;
  }, [editingService, allServices, originalServices]);

  const availableServices = useMemo(() => {
    const available = getAvailableServices();

    return available;
  }, [allServices, originalServices, services]);

  const availableComboOptions = useMemo(() => {
    const selectedComboIds = new Set(selectedComboServices.map((combo) => combo._id));
    return availableComboServices.filter((combo) => !selectedComboIds.has(combo._id));
  }, [availableComboServices, selectedComboServices]);

  const filteredCategoriesMemo = useMemo(() => {
    console.log('🔄 filteredCategoriesMemo running...');
    console.log('📋 Categories available:', categories.length);
    console.log('🔧 Selected filters - Gender:', selectedAddGenderFilters, 'ServiceType:', selectedAddServiceTypeFilters);

    if (categories.length === 0) {
      console.log('📭 No categories fetched yet');
      return [];
    }

    const matchingCategoryNames = new Set<string>();

    console.log('🔍 Checking categories - Available services:', availableServices.length, 'Available combos:', availableComboOptions.length);
    console.log('📦 All available services:', availableServices.map(s => ({ name: s.name, category: s.category })));

    // Check all available services based on gender and service type only
    availableServices.forEach((service, idx) => {
      const serviceTypes = normalizeServiceTypes(service);
      const genders = normalizeGenders(service);
      const hasCategory = !!service.category;

      console.log(`Service ${idx}: ${service.name}, Category: ${service.category}, Has Category: ${hasCategory}`);

      if (service.category && matchesGenderAndServiceTypeFilters(serviceTypes, genders)) {
        matchingCategoryNames.add(service.category);
        console.log('✅ Service matched:', service.name, '-> Category:', service.category);
      } else {
        // console.log('❌ Service NOT matched:', service.name, 'Reason: No category or filter mismatch');
      }
    });

    console.log('📦 Available combos:', availableComboOptions.map(c => ({ name: c.comboName, category: c.category })));

    // Check all available combo services based on gender and service type only
    availableComboOptions.forEach((combo, idx) => {
      const comboTypes = normalizeComboServiceTypes(combo);
      const comboGenders = (combo.genderSupport || [])
        .map((gender) => (gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender))
        .filter((gender) => gender === 'Male' || gender === 'Female');
      const hasCategory = !!combo.category;

      console.log(`Combo ${idx}: ${combo.comboName}, Category: ${combo.category}, Has Category: ${hasCategory}`);

      if (combo.category && matchesGenderAndServiceTypeFilters(comboTypes, comboGenders)) {
        matchingCategoryNames.add(combo.category);
        console.log('✅ Combo matched:', combo.comboName, '-> Category:', combo.category);
      } else {
        console.log('❌ Combo NOT matched:', combo.comboName, 'Reason: No category or filter mismatch');
      }
    });

    // Return filtered categories from API
    const filtered = categories.filter(cat => matchingCategoryNames.has(cat.categoryName));
    console.log('📋 Final filtered categories:', filtered.length, filtered.map(c => c.categoryName));

    // If no filtered categories found, return all categories as fallback
    if (filtered.length === 0) {
      console.log('⚠️ No filtered categories found, showing all categories as fallback');
      return categories;
    }
    return filtered;
  }, [categories, availableServices, availableComboOptions, selectedAddGenderFilters, selectedAddServiceTypeFilters]);

  const filteredAvailableServices = useMemo(() => {
    // When a subcategory is selected, use services fetched from the category API
    const servicesToFilter = selectedSubcategory ? categoryServices : availableServices;

    // Filter out services that the stylist already has selected
    const selectedServiceIds = new Set(services.map((s) => s.serviceId));
    const unselectedServices = servicesToFilter.filter(
      (service) => !selectedServiceIds.has(service.serviceId),
    );

    // If using category services and they are loaded, filter by gender and service type only
    if (selectedSubcategory && categoryServices.length > 0) {
      const filtered = unselectedServices.filter((service) => {
        const serviceTypes = normalizeServiceTypes(service);
        const genders = normalizeGenders(service);

        // Match gender filter
        const matchesGender =
          selectedAddGenderFilters.length === 0 ||
          selectedAddGenderFilters.some((filter) =>
            genders.includes(mapAddGenderFilterToBackend(filter)),
          );

        // Match service type filter
        const matchesType =
          selectedAddServiceTypeFilters.length === 0 ||
          selectedAddServiceTypeFilters.some((filter) =>
            serviceTypes.includes(mapAddServiceTypeFilterToBackend(filter)),
          );

        return matchesGender && matchesType;
      });

      console.log('📊 Category Services Filtered:');
      console.log('   - Total category services:', categoryServices.length);
      console.log('   - After filtering:', filtered.length);
      console.log('   - Gender filters:', selectedAddGenderFilters);
      console.log('   - Service type filters:', selectedAddServiceTypeFilters);

      return filtered;
    }

    // For non-category services, apply normal filtering
    return unselectedServices.filter((service) =>
      matchesAddFilters(normalizeServiceTypes(service), normalizeGenders(service), service.category),
    );
  }, [availableServices, categoryServices, services, selectedSubcategory, selectedAddGenderFilters, selectedAddServiceTypeFilters, selectedAddCategoryFilter]);

  const filteredAvailableComboOptions = useMemo(() => {
    return availableComboOptions.filter((combo) =>
      matchesAddFilters(
        normalizeComboServiceTypes(combo),
        (combo.genderSupport || [])
          .map((gender) => (gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender))
          .filter((gender) => gender === 'Male' || gender === 'Female'),
        combo.category,
      ),
    );
  }, [availableComboOptions, selectedAddGenderFilters, selectedAddServiceTypeFilters, selectedAddCategoryFilter]);

  const hasActiveAddFilters =
    selectedAddGenderFilters.length > 0 || selectedAddServiceTypeFilters.length > 0 || !!selectedAddCategoryFilter;
  const hasAnyAvailableOptions =
    filteredAvailableServices.length > 0 || filteredAvailableComboOptions.length > 0;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>My Services</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onUpgradePlan && (
            <TouchableOpacity
              onPress={onUpgradePlan}
              style={styles.upgradeHeaderBtn}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#FD8B36', '#FF5E00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeHeaderGradient}>
                <Icon name="workspace-premium" size={14} color="#fff" />
                <Text style={styles.upgradeHeaderText}>Upgrade</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleOpenAddServiceModal}
            style={styles.addButtonHeader}
            activeOpacity={0.7}>
            <Icon name="add" size={24} color="#FD8B36" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.serviceCardShimmer}>
              <View style={styles.serviceHeaderShimmer}>
                <Shimmer width={60} height={60} borderRadius={30} />
                <View style={styles.serviceInfoShimmer}>
                  <Shimmer width="70%" height={20} borderRadius={8} style={{ marginBottom: 8 }} />
                  <Shimmer width="40%" height={16} borderRadius={8} />
                </View>
              </View>
              <View style={styles.detailsShimmer}>
                <Shimmer width={100} height={14} borderRadius={8} />
                <Shimmer width={100} height={14} borderRadius={8} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : services.length > 0 ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          <View style={styles.listSummary}>
            <Text style={styles.listSummaryText}>{services.length} services added</Text>
          </View>
          {sortedServices.map((service, index) => (
            <View key={service.serviceId || service._id || index} style={styles.serviceCard}>
              {specialServiceIds.has(service.serviceId) && (
                <View style={styles.specialBadgeTopRight}>
                  <Icon name="stars" size={14} color="#A54500" />
                </View>
              )}
              <View style={styles.serviceHeader}>
                <View style={styles.serviceIconContainer}>
                  <RotatingServiceImage service={service} size={60} />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceNameText}>{service.serviceName}</Text>
                  <View style={styles.pricePill}>
                    <Icon name="currency-rupee" size={13} color="#FD8B36" />
                    <Text style={styles.servicePrice}>{service.amount}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.serviceDetails}>
                <View style={styles.detailChip}>
                  <Icon
                    name={getServiceTypeIcon(formatServiceType(service.serviceType))}
                    size={16}
                    color="#555"
                  />
                  <Text style={styles.detailText}>{formatServiceType(service.serviceType)}</Text>
                </View>
                <View style={styles.detailChip}>
                  <Icon
                    name={getGenderIcon(formatGender(service.gender))}
                    size={16}
                    color="#555"
                  />
                  <Text style={styles.detailText}>{formatGender(service.gender)}</Text>
                </View>
              </View>

              <View style={styles.serviceActionsRow}>
                <TouchableOpacity
                  onPress={() => handleEdit(service, index)}
                  style={[styles.actionButton, styles.editActionButton]}
                  activeOpacity={0.8}>
                  <Icon name="edit" size={17} color='#FD8B36' />
                  <Text style={[styles.actionButtonText, styles.editActionText]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(index)}
                  style={[styles.actionButton, styles.deleteActionButton]}
                  activeOpacity={0.8}>
                  <Icon name="delete" size={17} color="#E4572E" />
                  <Text style={[styles.actionButtonText, styles.deleteActionText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Selected Combo Services Section */}
          {selectedComboServices.length > 0 && (
            <View>
              <View style={styles.combSectionDivider}>
                <Text style={styles.combSectionTitle}>Your Combo Packages</Text>
              </View>

              {selectedComboServices.map((combo) => {
                const displayServiceTypes =
                  combo.stylistServiceType && combo.stylistServiceType.length > 0
                    ? combo.stylistServiceType
                    : normalizeComboServiceTypes(combo);
                const displayGenders =
                  combo.stylistGender && combo.stylistGender.length > 0
                    ? combo.stylistGender
                    : normalizeComboGenders(combo.genderSupport);
                const displayPrice =
                  typeof combo.stylistAmount === 'number' ? combo.stylistAmount : combo.discountedPrice;

                return (
                  <View key={combo._id} style={styles.selectedComboServiceCard}>
                    {/* <View style={styles.comboBadge}>
                    <Icon name="card-gift-card" size={12} color="#fff" />
                    <Text style={styles.comboBadgeText}>COMBO</Text>
                  </View> */}

                    <View style={styles.comboServiceHeader}>
                      <View style={styles.comboServiceInfo}>
                        <Text style={styles.comboServiceName}>{combo.comboName}</Text>
                        <Text style={styles.comboServiceDesc} numberOfLines={1}>
                          {combo.description}
                        </Text>

                        {/* Price Section */}
                        <View style={styles.comboPriceContainer}>
                          <Text style={styles.comboOriginalPrice}>₹{combo.originalPrice}</Text>
                          <Text style={styles.comboPriceSeparator}>→</Text>
                          <Text style={styles.comboPriceDiscounted}>₹{displayPrice}</Text>
                          <View style={styles.comboDiscountBadge}>
                            <Text style={styles.comboDiscountText}>-{combo.discountPercentage}%</Text>
                          </View>
                        </View>

                        {/* Duration and Tags */}
                        <View style={styles.comboDurationContainer}>
                          <Icon name="schedule" size={12} color="#FD8B36" />
                          <Text style={styles.comboDurationText}>{combo.duration}</Text>
                        </View>

                        {/* Included Services Tags */}
                        <View style={styles.comboTagsContainer}>
                          {displayGenders.map((gender, idx) => (
                            <View key={`gender-${idx}`} style={styles.comboTag}>
                              <Text style={styles.comboTagText}>{gender}</Text>
                            </View>
                          ))}
                          {displayServiceTypes.slice(0, 2).map((type, idx) => (
                            <View key={`type-${idx}`} style={styles.comboTag}>
                              <Text style={styles.comboTagText}>{type}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.comboDeleteButton}
                      onPress={() => handleDeleteCombo(combo)}
                      disabled={saving}
                      activeOpacity={0.8}>
                      <Icon name="delete" size={20} color="#E4572E" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="room-service" size={64} color="#E0E0E0" />
          <Text style={styles.emptyText}>No Services Found</Text>
          <Text style={styles.emptySubtext}>
            You haven't selected any services yet
          </Text>
          <TouchableOpacity
            style={styles.addButtonEmpty}
            onPress={handleOpenAddServiceModal}
            activeOpacity={0.8}>
            <Icon name="add" size={20} color="#fff" />
            <Text style={styles.addButtonEmptyText}>Add Service</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Action Button */}
      {services.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleOpenAddServiceModal}
          activeOpacity={0.8}>
          <LinearGradient {...GRADIENT_CONFIG} style={styles.fabGradient}>
            <Icon name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Add Service Selection Modal */}
      <Modal
        visible={showAddServiceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseAddServiceModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Service</Text>
              <TouchableOpacity
                onPress={handleCloseAddServiceModal}
                style={styles.modalCloseButton}
                activeOpacity={0.7}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}>
              {loadingServices || loadingCategoryServices ? (
                <View style={styles.loadingModalContainer}>
                  <ActivityIndicator size="large" color="#FD8B36" />
                  <Text style={styles.loadingModalText}>Loading services...</Text>
                </View>
              ) : !hasAnyAvailableOptions && allServices.length === 0 && availableComboServices.length === 0 ? (
                <View style={styles.emptyModalContainer}>
                  <Icon name="error-outline" size={64} color="#FD8B36" />
                  <Text style={styles.emptyModalText}>No Services Found</Text>
                  <Text style={styles.emptyModalSubtext}>
                    Unable to load services. Please try again.
                  </Text>
                </View>
              ) : hasActiveAddFilters && !hasAnyAvailableOptions ? (
                <>
                  {/* Show Filters for user to adjust */}
                  <View style={styles.filterRow}>
                    <View style={[styles.filterGroup, styles.filterGroupHalf]}>
                      <Text style={styles.filterTitle}>Gender Filter</Text>
                      <View style={styles.filterChipRow}>
                        {ADD_GENDER_FILTERS.map((filter) =>
                          renderFilterChip(
                            filter,
                            selectedAddGenderFilters.includes(filter),
                            () => toggleAddGenderFilter(filter),
                          ),
                        )}
                      </View>
                    </View>

                    <View style={[styles.filterGroup, styles.filterGroupHalf]}>
                      <Text style={styles.filterTitle}>Service Type Filter</Text>
                      <View style={styles.filterChipRow}>
                        {ADD_SERVICE_TYPE_FILTERS.map((filter) =>
                          renderFilterChip(
                            filter,
                            selectedAddServiceTypeFilters.includes(filter),
                            () => toggleAddServiceTypeFilter(filter),
                          ),
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.emptyModalContainer}>
                    <Icon name="tune" size={64} color="#FD8B36" />
                    <Text style={styles.emptyModalText}>No Matching Services</Text>
                    <Text style={styles.emptyModalSubtext}>
                      No services found matching your current filters. Try adjusting them below.
                    </Text>
                  </View>

                  {/* <TouchableOpacity
                    style={styles.clearFilterButton}
                    onPress={() => {
                      setSelectedAddGenderFilters(['Women']);
                      setSelectedAddServiceTypeFilters(['Salon']);
                      setSelectedAddCategoryFilter('');
                    }}
                    activeOpacity={0.8}>
                    <Text style={styles.clearFilterButtonText}>Reset to Default</Text>
                  </TouchableOpacity> */}
                </>
              ) : selectedSubcategory && filteredAvailableServices.length === 0 && !loadingCategoryServices ? (
                <View style={styles.emptyModalContainer}>
                  <Icon name="check-circle" size={64} color="#4CAF50" />
                  <Text style={styles.emptyModalText}>All Services Added</Text>
                  <Text style={styles.emptyModalSubtext}>
                    You have already added all available services in this category
                  </Text>
                  <TouchableOpacity
                    style={styles.backToSubcategoryBtn}
                    onPress={() => setSelectedSubcategory(null)}
                    activeOpacity={0.8}>
                    <Icon name="arrow-back" size={16} color="#FD8B36" />
                    <Text style={styles.backToSubcategoryBtnText}>Choose Another Category</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* STEP 1: Show Main Categories - No main category selected yet */}
                  {!selectedMainCategory && mainCategories.length > 0 && (() => {
                    // Identify stylist's selected main categories
                    const stylistCatIdSet = new Set(stylistMainCategoryIds.map((id) => String(id)));
                    const primaryCategories = mainCategories.filter((cat) => {
                      const id1 = cat.mainCategoryId ? String(cat.mainCategoryId) : '';
                      const id2 = cat._id ? String(cat._id) : '';
                      return (id1 && stylistCatIdSet.has(id1)) || (id2 && stylistCatIdSet.has(id2));
                    });

                    // If stylist has no main categories saved in profile yet, show all as primary
                    const hasStylistCategoryPreference = primaryCategories.length > 0;
                    const initialList = hasStylistCategoryPreference ? primaryCategories : mainCategories;
                    const otherCategories = hasStylistCategoryPreference
                      ? mainCategories.filter((cat) => !primaryCategories.some((p) => (p.mainCategoryId || p._id) === (cat.mainCategoryId || cat._id)))
                      : [];

                    return (
                      <View style={styles.mainCategorySection}>
                        <Text style={styles.filterTitle}>
                          {hasStylistCategoryPreference ? 'Your Main Category' : 'Select a Main Category'}
                        </Text>
                        <View style={styles.mainCategoryListContainer}>
                          {initialList.map((mainCat: IMainCategory) => {
                            const subcategoryCount = getMainCategorySubcategoryCount(mainCat);

                            return (
                              <TouchableOpacity
                                key={mainCat._id || mainCat.mainCategoryId}
                                style={styles.mainCategoryCard}
                                onPress={() => handleSelectMainCategory(mainCat)}
                                activeOpacity={0.7}>
                                {mainCat.mainCategoryImage && (
                                  <Image
                                    source={{ uri: mainCat.mainCategoryImage }}
                                    style={styles.mainCategoryCardImage}
                                  />
                                )}
                                <View style={styles.mainCategoryCardContent}>
                                  <Text style={styles.mainCategoryCardName}>
                                    {mainCat.mainCategoryName}
                                  </Text>
                                  <Text style={styles.mainCategoryCardCount}>
                                    {subcategoryCount} {subcategoryCount === 1 ? 'category' : 'categories'}
                                  </Text>
                                </View>
                                <Icon name="chevron-right" size={24} color="#FD8B36" />
                              </TouchableOpacity>
                            );
                          })}

                          {/* "Add More / Other Services" Toggle Option */}
                          {hasStylistCategoryPreference && otherCategories.length > 0 && (
                            <>
                              {!showAllMainCategories ? (
                                <TouchableOpacity
                                  style={styles.addMoreCategoriesCard}
                                  onPress={() => setShowAllMainCategories(true)}
                                  activeOpacity={0.8}>
                                  <View style={styles.addMoreIconWrap}>
                                    <Icon name="add" size={20} color="#FD8B36" />
                                  </View>
                                  <View style={styles.addMoreContent}>
                                    <Text style={styles.addMoreTitle}>Add More Services</Text>
                                    <Text style={styles.addMoreSubtitle}>
                                      Explore hair color, skin care & other categories
                                    </Text>
                                  </View>
                                  <Icon name="expand-more" size={24} color="#FD8B36" />
                                </TouchableOpacity>
                              ) : (
                                <>
                                  <View style={styles.otherCategoriesHeader}>
                                    <Text style={styles.otherCategoriesHeaderText}>Other Categories</Text>
                                    <TouchableOpacity
                                      onPress={() => setShowAllMainCategories(false)}
                                      activeOpacity={0.7}>
                                      <Text style={styles.showLessText}>Show Less</Text>
                                    </TouchableOpacity>
                                  </View>
                                  {otherCategories.map((mainCat: IMainCategory) => {
                                    const subcategoryCount = getMainCategorySubcategoryCount(mainCat);

                                    return (
                                      <TouchableOpacity
                                        key={mainCat._id || mainCat.mainCategoryId}
                                        style={styles.mainCategoryCard}
                                        onPress={() => handleSelectMainCategory(mainCat)}
                                        activeOpacity={0.7}>
                                        {mainCat.mainCategoryImage && (
                                          <Image
                                            source={{ uri: mainCat.mainCategoryImage }}
                                            style={styles.mainCategoryCardImage}
                                          />
                                        )}
                                        <View style={styles.mainCategoryCardContent}>
                                          <Text style={styles.mainCategoryCardName}>
                                            {mainCat.mainCategoryName}
                                          </Text>
                                          <Text style={styles.mainCategoryCardCount}>
                                            {subcategoryCount} {subcategoryCount === 1 ? 'category' : 'categories'}
                                          </Text>
                                        </View>
                                        <Icon name="chevron-right" size={24} color="#FD8B36" />
                                      </TouchableOpacity>
                                    );
                                  })}
                                </>
                              )}
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })()}

                  {/* STEP 2: Show Subcategories - Main category selected, waiting for subcategory */}
                  {selectedMainCategory && !selectedSubcategory && filteredSubcategories.length > 0 && (
                    <View style={styles.subcategoryStepContainer}>
                      <View style={styles.subcategoryHeader}>
                        <TouchableOpacity
                          onPress={handleResetCategorySelection}
                          style={styles.backToCategoryButton}
                          activeOpacity={0.7}>
                          <Icon name="arrow-back" size={24} color="#FD8B36" />
                          {/* <Text style={styles.backToCategoryText}>Back</Text> */}
                        </TouchableOpacity>
                        <Text style={styles.subcategoryHeaderTitle}>
                          {selectedMainCategory.mainCategoryName}
                        </Text>
                        <View style={{ width: 40 }} />
                      </View>

                      <Text style={styles.stepInstructionText}>Select a Category</Text>

                      <View style={styles.subcategoryListContainer}>
                        {filteredSubcategories.map((subcat) => (
                          <TouchableOpacity
                            key={subcat._id || subcat.categoryId}
                            style={styles.subcategoryCard}
                            onPress={() => handleSelectSubcategory(subcat)}
                            activeOpacity={0.7}>
                            <View style={styles.subcategoryCardContent}>
                              <Text style={styles.subcategoryCardName}>
                                {subcat.categoryName}
                              </Text>
                            </View>
                            <Icon name="chevron-right" size={24} color="#FD8B36" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* STEP 3: Show Filters and Services - Subcategory selected */}
                  {selectedSubcategory && (
                    <>
                      <View style={styles.selectedPathContainer}>
                        <TouchableOpacity
                          onPress={handleResetCategorySelection}
                          style={styles.backToCategoryButton}
                          activeOpacity={0.7}>
                          <Icon name="arrow-back" size={20} color="#FD8B36" />

                        </TouchableOpacity>
                        <View style={styles.breadcrumb}>
                          <Text style={styles.breadcrumbText}>
                            {selectedMainCategory?.mainCategoryName}
                          </Text>
                          <Icon name="chevron-right" size={16} color="#999" />
                          <Text style={styles.breadcrumbTextActive}>
                            {selectedSubcategory.categoryName}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.filterRow}>
                        <View style={[styles.filterGroup, styles.filterGroupHalf]}>
                          <Text style={styles.filterTitle}>Gender Filter</Text>
                          <View style={styles.filterChipRow}>
                            {ADD_GENDER_FILTERS.map((filter) =>
                              renderFilterChip(
                                filter,
                                selectedAddGenderFilters.includes(filter),
                                () => toggleAddGenderFilter(filter),
                              ),
                            )}
                          </View>
                        </View>

                        <View style={[styles.filterGroup, styles.filterGroupHalf]}>
                          <Text style={styles.filterTitle}>Service Type Filter</Text>
                          <View style={styles.filterChipRow}>
                            {ADD_SERVICE_TYPE_FILTERS.map((filter) =>
                              renderFilterChip(
                                filter,
                                selectedAddServiceTypeFilters.includes(filter),
                                () => toggleAddServiceTypeFilter(filter),
                              ),
                            )}
                          </View>
                        </View>
                      </View>
                    </>
                  )}

                  {/* Services list - Only show when subcategory selected */}
                  {selectedSubcategory && filteredAvailableServices.map((service: OriginalService) => {
                    const normalizedServiceTypes = normalizeServiceTypes(service);
                    const normalizedGenders = normalizeGenders(service);
                    const serviceName = getServiceName(service);
                    const tempService: Service = {
                      serviceId: service.serviceId,
                      serviceName: serviceName,
                      amount: 0,
                      serviceType: normalizedServiceTypes,
                      gender: normalizedGenders,
                      images: service.images,
                    };

                    return (
                      <TouchableOpacity
                        key={service.serviceId}
                        style={styles.serviceSelectCard}
                        onPress={() => handleSelectService(service)}
                        activeOpacity={0.7}>
                        <RotatingServiceImage service={tempService} size={48} />
                        <View style={styles.serviceSelectInfo}>
                          <Text style={styles.serviceSelectName}>{serviceName}</Text>
                          <View style={styles.serviceSelectTags}>
                            {normalizedServiceTypes.slice(0, 2).map((type: string, idx: number) => (
                              <View key={idx} style={styles.serviceSelectTag}>
                                <Text style={styles.serviceSelectTagText}>
                                  {type === 'Home' || type === 'At Home' ? 'At Home' : type}
                                </Text>
                              </View>
                            ))}
                            {normalizedGenders.slice(0, 2).map((gender: string, idx: number) => (
                              <View key={idx} style={styles.serviceSelectTag}>
                                <Text style={styles.serviceSelectTagText}>{gender}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                        <Icon name="chevron-right" size={24} color="#999" />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* Combo Services Section in Modal */}
              {/* {filteredAvailableComboOptions.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <View style={styles.modalSectionDivider}>
                    <Text style={styles.modalSectionTitle}>Premium Combo Packages</Text>
                  </View>

                  {filteredAvailableComboOptions.map((combo) => {
                    return (
                    <TouchableOpacity
                      key={combo._id}
                      style={styles.comboServiceSelectCard}
                      onPress={() => handleSelectCombo(combo)}
                      disabled={saving}
                      activeOpacity={saving ? 1 : 0.7}>
                     

                      <View style={styles.comboSelectInfo}>
                        <Text style={styles.comboSelectName}>{combo.comboName}</Text>
                        <Text style={styles.comboSelectDesc} numberOfLines={1}>
                          {combo.description}
                        </Text>

                       
                        <View style={styles.comboSelectPrice}>
                          <Text style={styles.comboSelectOriginal}>₹{combo.originalPrice}</Text>
                          <Text style={styles.comboSelectDiscounted}>₹{combo.discountedPrice}</Text>
                          <LinearGradient {...GRADIENT_CONFIG} style={styles.comboSelectDiscount}>
                            <Text style={styles.comboSelectDiscountText}>-{combo.discountPercentage}%</Text>
                          </LinearGradient>
                        </View>

                     
                        <View style={styles.comboSelectTags}>
                          {combo.genderSupport.slice(0, 2).map((gender, idx) => (
                            <View key={`gender-${idx}`} style={styles.comboSelectTag}>
                              <Text style={styles.comboSelectTagText}>{gender}</Text>
                            </View>
                          ))}
                          {normalizeComboServiceTypes(combo).slice(0, 2).map((type, idx) => (
                            <View key={`type-${idx}`} style={styles.comboSelectTag}>
                              <Text style={styles.comboSelectTagText}>{type}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <Icon name="chevron-right" size={24} color={saving ? '#CCC' : '#999'} />
                    </TouchableOpacity>
                  );
                  })}
                </View>
              )} */}

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Combo Preference Modal */}
      <Modal
        visible={showComboPreferenceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseComboPreferenceModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Combo Preferences</Text>
              <TouchableOpacity
                onPress={handleCloseComboPreferenceModal}
                style={styles.modalCloseButton}
                activeOpacity={0.7}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Combo Name</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>{pendingCombo?.comboName || '-'}</Text>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Combo Amount</Text>
                <View style={[styles.amountInputContainer, styles.disabledAmountInputContainer]}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="Amount"
                    placeholderTextColor="#999"
                    value={comboAmount}
                    editable={false}
                    selectTextOnFocus={false}
                  />
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Select Service Type</Text>
                <View style={styles.checkboxContainer}>
                  {normalizeComboServiceTypes(pendingCombo ?? undefined).map((serviceType) => (
                    <TouchableOpacity
                      key={serviceType}
                      style={styles.checkboxOption}
                      onPress={() => {
                        if (selectedComboServiceTypes.includes(serviceType)) {
                          setSelectedComboServiceTypes(
                            selectedComboServiceTypes.filter((type) => type !== serviceType)
                          );
                        } else {
                          setSelectedComboServiceTypes([...selectedComboServiceTypes, serviceType]);
                        }
                      }}
                      activeOpacity={0.7}>
                      <View
                        style={[
                          styles.checkbox,
                          selectedComboServiceTypes.includes(serviceType) && styles.checkboxSelected,
                        ]}>
                        {selectedComboServiceTypes.includes(serviceType) && (
                          <LinearGradient {...GRADIENT_CONFIG} style={styles.checkboxGradient}>
                            <Icon name="check" size={16} color="#fff" />
                          </LinearGradient>
                        )}
                      </View>
                      <Text style={styles.checkboxLabel}>{serviceType}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Gender Preference</Text>
                <View style={styles.checkboxContainer}>
                  {(pendingCombo?.genderSupport || [])
                    .map((gender) => (gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : gender))
                    .filter((gender, index, arr) =>
                      (gender === 'Male' || gender === 'Female') && arr.indexOf(gender) === index
                    )
                    .map((gender) => (
                      <TouchableOpacity
                        key={gender}
                        style={styles.checkboxOption}
                        onPress={() => {
                          if (selectedComboGenders.includes(gender)) {
                            setSelectedComboGenders(selectedComboGenders.filter((g) => g !== gender));
                          } else {
                            setSelectedComboGenders([...selectedComboGenders, gender]);
                          }
                        }}
                        activeOpacity={0.7}>
                        <View
                          style={[
                            styles.checkbox,
                            selectedComboGenders.includes(gender) && styles.checkboxSelected,
                          ]}>
                          {selectedComboGenders.includes(gender) && (
                            <LinearGradient {...GRADIENT_CONFIG} style={styles.checkboxGradient}>
                              <Icon name="check" size={16} color="#fff" />
                            </LinearGradient>
                          )}
                        </View>
                        <Text style={styles.checkboxLabel}>{gender}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveComboWithPreferences}
                activeOpacity={0.8}
                disabled={saving}>
                <LinearGradient
                  {...GRADIENT_CONFIG}
                  style={[styles.saveButtonGradient, saving && styles.saveButtonGradientDisabled]}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Combo Service</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingServiceIndex === -1 ? 'Add Service' : 'Edit Service'}
              </Text>
              <TouchableOpacity
                onPress={handleCloseModal}
                style={styles.modalCloseButton}
                activeOpacity={0.7}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {/* Service Name (Read-only) */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Service Name</Text>

                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>{editingService?.serviceName}</Text>
                </View>
              </View>

              {/* Enter Amount */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Enter Amount</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="Enter amount"
                    placeholderTextColor="#999"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Select Service Type - Always show from backend */}
              {availableOptions.serviceTypes.length > 0 ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Select Service Type</Text>
                  <View style={styles.checkboxContainer}>
                    {availableOptions.serviceTypes.map((serviceType: string) => {
                      // Normalize service type values (same as SelectServiceScreen)
                      const normalizedType =
                        serviceType === 'Home' || serviceType === 'At Home'
                          ? 'At Home'
                          : serviceType;
                      return (
                        <TouchableOpacity
                          key={serviceType}
                          style={styles.checkboxOption}
                          onPress={() => {
                            if (selectedServiceTypes.includes(normalizedType)) {
                              setSelectedServiceTypes(
                                selectedServiceTypes.filter((type) => type !== normalizedType)
                              );
                            } else {
                              setSelectedServiceTypes([...selectedServiceTypes, normalizedType]);
                            }
                          }}
                          activeOpacity={0.7}>
                          <View
                            style={[
                              styles.checkbox,
                              selectedServiceTypes.includes(normalizedType) &&
                              styles.checkboxSelected,
                            ]}>
                            {selectedServiceTypes.includes(normalizedType) && (
                              <LinearGradient {...GRADIENT_CONFIG} style={styles.checkboxGradient}>
                                <Icon name="check" size={16} color="#fff" />
                              </LinearGradient>
                            )}
                          </View>
                          <Text style={styles.checkboxLabel}>{normalizedType}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : editingService ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Select Service Type</Text>
                  <Text style={styles.noOptionsText}>
                    No service types available. Please refresh and try again.
                  </Text>
                </View>
              ) : null}

              {/* Gender Selection - Always show from backend */}
              {!editingService ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Gender</Text>
                  <Text style={styles.noOptionsText}>Loading gender options...</Text>
                </View>
              ) : availableOptions.genders.length > 0 ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Gender</Text>
                  <View style={styles.checkboxContainer}>
                    {availableOptions.genders.map((gender: string) => (
                      <TouchableOpacity
                        key={gender}
                        style={styles.checkboxOption}
                        onPress={() => {
                          if (selectedGenders.includes(gender)) {
                            setSelectedGenders(selectedGenders.filter((g) => g !== gender));
                          } else {
                            setSelectedGenders([...selectedGenders, gender]);
                          }
                        }}
                        activeOpacity={0.7}>
                        <View
                          style={[
                            styles.checkbox,
                            selectedGenders.includes(gender) && styles.checkboxSelected,
                          ]}>
                          {selectedGenders.includes(gender) && (
                            <LinearGradient {...GRADIENT_CONFIG} style={styles.checkboxGradient}>
                              <Icon name="check" size={16} color="#fff" />
                            </LinearGradient>
                          )}
                        </View>
                        <Text style={styles.checkboxLabel}>{gender}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : editingService ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Gender</Text>
                  <Text style={styles.noOptionsText}>
                    No gender options available. Please refresh and try again.
                  </Text>
                </View>
              ) : null}

              <View style={styles.modalSection}>
                <View style={styles.specialServiceRow}>
                  <View style={styles.specialServiceTextContainer}>
                    <Text style={styles.modalLabel}>Special Service</Text>
                    <Text style={styles.specialServiceHelper}>
                      {specialServicePlanLabel}: {projectedSpecialServiceCount}/{specialServiceLimit} used
                    </Text>
                  </View>
                  <SmoothToggle
                    value={isSpecialService}
                    disabled={hasReachedSpecialServiceLimit && !isSpecialService}
                    onValueChange={(value) => {
                      if (value && hasReachedSpecialServiceLimit) {
                        modal.showAlert(
                          'Limit Reached',
                          `Your ${specialServicePlanLabel} plan allows up to ${specialServiceLimit} special service${specialServiceLimit > 1 ? 's' : ''}.`,
                          'error',
                        );
                        return;
                      }

                      setIsSpecialService(value);
                    }}
                    activeTrackColor={PRIMARY_COLOR}
                    inactiveTrackColor="#E4D8CE"
                    thumbColor="#FFFFFF"
                  />
                </View>
                <Text style={styles.specialServiceNote}>
                  Highlight this expertise as a premium special service on your profile.
                </Text>

                {onUpgradePlan && (
                  <TouchableOpacity
                    style={styles.upgradeBannerCard}
                    onPress={onUpgradePlan}
                    activeOpacity={0.85}>
                    <LinearGradient
                      colors={['#FFF5EC', '#FFE8D6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.upgradeBannerGradient}>
                      <View style={styles.upgradeBannerLeft}>
                        <View style={styles.upgradeBannerIconWrap}>
                          <Icon name="workspace-premium" size={22} color="#FD8B36" />
                        </View>
                        <View style={styles.upgradeBannerTextWrap}>
                          <Text style={styles.upgradeBannerTitle}>Upgrade Your Partner Plan</Text>
                          <Text style={styles.upgradeBannerSubtitle}>
                            Get top search rank, zero commission, and unlimited bookings
                          </Text>
                        </View>
                      </View>
                      <View style={styles.upgradeBannerAction}>
                        <Text style={styles.upgradeBannerActionText}>Upgrade</Text>
                        <Icon name="arrow-forward" size={14} color="#FD8B36" />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                {hasReachedSpecialServiceLimit ? (
                  <Text style={styles.specialServiceLimitText}>
                    Upgrade your plan or turn off another special service to add this one.
                  </Text>
                ) : null}
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                activeOpacity={0.8}
                disabled={saving}>
                <LinearGradient
                  {...GRADIENT_CONFIG}
                  style={[styles.saveButtonGradient, saving && styles.saveButtonGradientDisabled]}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingServiceIndex === -1 ? 'Add Service' : 'Save Changes'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Modal */}
      <CustomModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
        onClose={modal.hideModal}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
    paddingBottom: 16,
    // backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: TEXT_COLOR,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  addButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: compactTopPadding(16),
    paddingBottom: 36,
  },
  listSummary: {
    marginBottom: 12,
    alignSelf: 'flex-start',
    backgroundColor: CARD_ACCENT,
    borderWidth: 1,
    borderColor: 'rgba(253, 139, 54, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  listSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  serviceCard: {
    backgroundColor: '#fff',
    position: 'relative',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 3 },
    // shadowOpacity: 0.07,
    // shadowRadius: 10,
    // elevation: 2,
    // borderWidth: 1,
    // borderColor: 'rgba(0,0,0,0.08)',
  },
  serviceCardShimmer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  serviceHeaderShimmer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  serviceInitials: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: TEXT_COLOR,
  },
  serviceImage: {
    borderWidth: 2,
    borderColor: '#F0F0F0',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceInfoShimmer: {
    flex: 1,
    marginLeft: 16,
  },
  serviceNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  pricePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: CARD_ACCENT,
    borderColor: 'rgba(253, 139, 54, 0.4)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  specialBadgeTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFEBDC',
    borderWidth: 1,
    borderColor: '#FFC9A8',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editActionButton: {
    backgroundColor: CARD_ACCENT,
    borderWidth: 1,
    borderColor: 'rgba(253, 139, 54, 0.5)',
  },
  deleteActionButton: {
    backgroundColor: '#fff',
    borderColor: 'rgba(228, 80, 54, 0.5)',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  editActionText: {
    color: PRIMARY_COLOR,
  },
  deleteActionText: {
    color: '#E4572E',
  },
  serviceDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: compactTopPadding(12),
    borderTopWidth: 1,
    borderTopColor: '#F3EAE3',
  },
  detailsShimmer: {
    flexDirection: 'row',
    gap: 24,
    paddingTop: compactTopPadding(16),
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailText: {
    fontSize: 13,
    color: SECONDARY_TEXT_COLOR,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: SECONDARY_TEXT_COLOR,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: MUTED_TEXT_COLOR,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButtonEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 52,
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
  },
  addButtonEmptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  serviceSelectIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    backgroundColor: CARD_ACCENT,
  },
  serviceSelectInitials: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    color: TEXT_COLOR,
  },
  serviceSelectInfo: {
    flex: 1,
  },
  serviceSelectName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  serviceSelectTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  serviceSelectTag: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  serviceSelectTagText: {
    fontSize: 12,
    color: SECONDARY_TEXT_COLOR,
    fontWeight: '500',
  },
  emptyModalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyModalText: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyModalSubtext: {
    fontSize: 14,
    color: MUTED_TEXT_COLOR,
    textAlign: 'center',
  },
  clearFilterButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFF7F1',
    borderWidth: 1,
    borderColor: '#F1D7C1',
  },
  clearFilterButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  loadingModalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingModalText: {
    marginTop: 12,
    fontSize: 16,
    color: SECONDARY_TEXT_COLOR,
  },
  noOptionsText: {
    fontSize: 14,
    color: MUTED_TEXT_COLOR,
    fontStyle: 'italic',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    height: '100%'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(24),
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(24),
    paddingBottom: 24,
  },
  modalSection: {
    marginBottom: 24,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  filterGroup: {
    flex: 1,
  },
  filterGroupHalf: {
    minWidth: 0,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChipWrapper: {
    borderRadius: 999,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFF7F1',
    borderWidth: 1,
    borderColor: '#F1D7C1',
  },
  filterChipSelected: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: SECONDARY_TEXT_COLOR,
  },
  filterChipTextSelected: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  categoryFilterContainer: {
    marginBottom: 20,
  },
  categoryDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
  },
  categoryDropdownButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_COLOR,
    flex: 1,
  },
  categoryDropdownMenu: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 12,
    maxHeight: 200,
  },
  categoryDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryDropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: SECONDARY_TEXT_COLOR,
  },
  categoryDropdownItemTextSelected: {
    color: PRIMARY_COLOR,
    fontWeight: '700',
  },
  readOnlyField: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  readOnlyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  disabledAmountInputContainer: {
    opacity: 0.55,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    color: '#333',
    paddingVertical: 16,
  },
  specialServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  specialServiceTextContainer: {
    flex: 1,
  },
  specialServiceHelper: {
    fontSize: 13,
    color: SECONDARY_TEXT_COLOR,
    marginTop: -4,
  },
  specialServiceNote: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: SECONDARY_TEXT_COLOR,
  },
  specialServiceLimitText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: '#B45309',
    fontWeight: '600',
  },
  checkboxContainer: {
    gap: 12,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#C4B4A4',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    overflow: 'hidden',
  },
  checkboxSelected: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  checkboxGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
    color: TEXT_COLOR,
    fontWeight: '500',
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 52,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonGradientDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  /* Combo Service Styles */
  combSectionDivider: {
    marginTop: 32,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  combSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  comboServiceCard: {
    backgroundColor: '#FFF9F5',
    borderRadius: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE4D6',
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
  },
  comboBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FD8B36',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  comboBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  comboServiceHeader: {
    flex: 1,
    marginRight: 12,
    paddingTop: 0,
  },
  comboServiceInfo: {
    flex: 1,
  },
  comboServiceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  comboServiceDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  comboPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 4,
  },
  comboOriginalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  comboPriceSeparator: {
    fontSize: 14,
    color: '#FD8B36',
    fontWeight: 'bold',
  },
  comboPriceDiscounted: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FD8B36',
  },
  comboDiscountBadge: {
    backgroundColor: '#FD8B36',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  comboDiscountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  comboDurationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  comboDurationText: {
    fontSize: 12,
    color: '#666',
  },
  comboTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  comboTag: {
    backgroundColor: '#FFE4D6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  comboTagText: {
    fontSize: 11,
    color: '#A54500',
    fontWeight: '600',
  },
  comboAddButton: {
    backgroundColor: '#FD8B36',
    borderRadius: 12,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  comboAddButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  comboEmptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },

  /* Modal Combo Service Styles */
  modalSectionDivider: {
    marginVertical: 16,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: compactTopPadding(12),
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  comboServiceSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFF9F5',
    borderRadius: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#FFE4D6',
  },
  comboBadgeSmall: {
    backgroundColor: '#FD8B36',
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginRight: 8,
  },
  comboBadgeSmallText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  comboSelectInfo: {
    flex: 1,
  },
  comboSelectName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  comboSelectDesc: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  comboSelectPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  comboSelectOriginal: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  comboSelectDiscounted: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  comboSelectDiscount: {
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  comboSelectDiscountText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  comboSelectTags: {
    flexDirection: 'row',
    gap: 4,
  },
  comboSelectTag: {
    backgroundColor: '#FFE4D6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  comboSelectTagText: {
    fontSize: 10,
    color: '#A54500',
    fontWeight: '600',
  },

  /* Selected Combo Service Card on Main Page */
  selectedComboServiceCard: {
    backgroundColor: '#FFF9F5',
    borderRadius: 16,
    // marginHorizontal: 12,
    marginVertical: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE4D6',
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
  },
  comboDeleteButton: {
    backgroundColor: '#FFE4D6',
    borderRadius: 12,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },

  /* Main Category Section - Step 1 */
  mainCategorySection: {
    flex: 1,
    // paddingHorizontal: 16,
  },
  mainCategoryListContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: compactTopPadding(12),
  },
  mainCategoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  mainCategoryCardImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  mainCategoryCardContent: {
    flex: 1,
  },
  mainCategoryCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  mainCategoryCardCount: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },

  /* Subcategory Step - Step 2 */
  subcategoryStepContainer: {
    flex: 1,
    paddingHorizontal: 0,
  },
  subcategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  subcategoryHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  stepInstructionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: compactTopPadding(16),
    paddingBottom: 8,
  },
  subcategoryListContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  subcategoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  subcategoryCardContent: {
    flex: 1,
  },
  subcategoryCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },

  /* Selected Path Display - Step 3 */
  selectedPathContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF9F5',
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumb: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  breadcrumbText: {
    fontSize: 12,
    color: '#FD8B36',
    fontWeight: '600',
  },
  breadcrumbTextActive: {
    fontSize: 12,
    color: '#333',
    fontWeight: '700',
  },

  backToCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
  },
  backToCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FD8B36',
  },

  /* Upgrade Plan Header Button & Banner */
  upgradeHeaderBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  upgradeHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  upgradeHeaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  upgradeBannerCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F2D7C2',
  },
  upgradeBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  upgradeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  upgradeBannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFE3CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  upgradeBannerTextWrap: {
    flex: 1,
  },
  upgradeBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  upgradeBannerSubtitle: {
    fontSize: 11,
    color: '#705A48',
    marginTop: 2,
  },
  upgradeBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  upgradeBannerActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FD8B36',
  },

  /* Add More Categories / Toggle Option */
  addMoreCategoriesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F0',
    borderRadius: 14,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1.5,
    borderColor: '#FD8B36',
    borderStyle: 'dashed',
  },
  addMoreIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFE3CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addMoreContent: {
    flex: 1,
  },
  addMoreTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FD8B36',
  },
  addMoreSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  otherCategoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  otherCategoriesHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  showLessText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FD8B36',
  },
  backToSubcategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFF7F0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FD8B36',
  },
  backToSubcategoryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FD8B36',
  },
});

export default MyServiceScreen;
