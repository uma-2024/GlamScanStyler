import { QueuedModal as Modal } from '../popup/PopupProvider';
import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import Geolocation from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  MapPressEvent,
  Region,
} from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';
import {
  compactTopPadding,
  isCompactHeightScreen,
  isSmallScreen,
} from '../utils/responsiveLayout';
// import BottomNavigation from '../components/BottomNavigation';

interface LocationSelectionScreenProps {
  onBack?: () => void;
  onLocationSelect?: (location: string) => void;
  onWorkLocationSelect?: (location: string) => void;
  onNext?: (location: string) => void;
  onSkip?: () => void;
  userId?: string;
  initialLocation?: string;
  initialWorkLocation?: string;
  professionalType?: 'freelancer' | 'working_professional';
}

interface RecentLocation {
  id: string;
  address: string;
  city: string;
  zipCode: string;
  timestamp: number; // Unix timestamp for sorting and filtering
}

interface SearchResult {
  id: string;
  address: string;
  city: string;
  zipCode: string;
  type?: 'address' | 'city' | 'pincode' | 'api';
  lat?: string;
  lon?: string;
  state?: string;
  placeId?: string;
}

const PRIMARY_COLOR = '#FD8B36' ;
const GOOGLE_MAPS_API_KEY = 'AIzaSyAZvP9z0_uXXf4y_tOT4YEtymaq-EXrDJ4';

const DEFAULT_MAP_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.2090,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const USER_LOCATION_MAP_DELTA = 0.02;
const MIN_MAP_DELTA = 0.002;
const MAX_MAP_DELTA = 0.25;
const MAP_ZOOM_FACTOR = 0.55;
const CURRENT_LOCATION_VIEW_OFFSET_RATIO = 0.2;
const MIN_SEARCH_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 750;
const MAX_SEARCH_RESULTS = 8;
const TOP_OVERLAY_EXTRA_PADDING =
  isSmallScreen || isCompactHeightScreen ? 0 : 8;

interface MapCoordinate {
  latitude: number;
  longitude: number;
}

interface ParsedAddress {
  address: string;
  city: string;
  zipCode: string;
  formattedAddress: string;
}

const LocationSelectionScreen: React.FC<LocationSelectionScreenProps> = ({
  onBack,
  onLocationSelect,
  onWorkLocationSelect,
  onNext,
  onSkip,
  userId,
  initialLocation,
  initialWorkLocation,
  professionalType = 'freelancer',
}) => {
  const insets = useSafeAreaInsets();
  const [activeLocationTarget, setActiveLocationTarget] = useState<'primary' | 'work'>('primary');
  const [primaryLocationText, setPrimaryLocationText] = useState<string>(initialLocation || '');
  const [workLocationText, setWorkLocationText] = useState<string>(initialWorkLocation || '');
  const isWorkingProfessional = professionalType === 'working_professional';
  const onWorkLocationSelectRef = useRef(onWorkLocationSelect);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [currentLocationAddress, setCurrentLocationAddress] = useState<string | null>(null);
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [locationPreviewPresented, setLocationPreviewPresented] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const onLocationSelectRef = useRef(onLocationSelect);
  const onNextRef = useRef(onNext);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [showSavedAddressesModal, setShowSavedAddressesModal] = useState(false);
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualZipCode, setManualZipCode] = useState('');
  const [manualFloor, setManualFloor] = useState('');
  const [manualDetails, setManualDetails] = useState('');
  const [manualCoordinate, setManualCoordinate] = useState<MapCoordinate | null>(null);
  const [isSavingManualAddress, setIsSavingManualAddress] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<RecentLocation[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_MAP_REGION);
  const [mapMarker, setMapMarker] = useState<MapCoordinate | null>(null);
  const [mapSelectedAddress, setMapSelectedAddress] = useState<string | null>(null);
  const [isResolvingMapAddress, setIsResolvingMapAddress] = useState(false);
  const [isCurrentLocationPin, setIsCurrentLocationPin] = useState(false);
  const mapRef = useRef<MapView | null>(null);
  const searchInputRef = useRef<TextInput | null>(null);
  const hasRequestedInitialLocation = useRef(false);
  const hasShownLocationPermissionPrompt = useRef(false);

  const STORAGE_KEY = '@glammefypartner:recent_locations';
  const MAX_RECENT_DAYS = 30; // Show locations from last 30 days
  const MAX_RECENT_LOCATIONS = 20; // Maximum number of recent locations to store

  const handleCurrentLocationRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
    onWorkLocationSelectRef.current = onWorkLocationSelect;
    onNextRef.current = onNext;
  }, [onLocationSelect, onWorkLocationSelect, onNext]);

  // Load recent locations from storage on mount
  useEffect(() => {
    loadRecentLocations();
    if (!hasRequestedInitialLocation.current) {
      hasRequestedInitialLocation.current = true;
      handleCurrentLocationRef.current?.();
    }
  }, []);

  // Load saved addresses from API on mount
  useEffect(() => {
    if (userId) {
      loadSavedAddresses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Start the redirect only when this confirmation reaches the front of the queue.
  useEffect(() => {
    if (!selectedLocation) setLocationPreviewPresented(false);
    if (selectedLocation && locationPreviewPresented) {
      // Reset and animate progress bar
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      }).start();

      const timer = setTimeout(() => {
        if (onLocationSelectRef.current) {
          onLocationSelectRef.current(selectedLocation);
        }
        if (onNextRef.current) {
          onNextRef.current(selectedLocation);
        }
        setSelectedLocation(null); // Clear after navigation
        progressAnim.setValue(0); // Reset progress
      }, 3000); // 3 seconds

      return () => {
        clearTimeout(timer);
        progressAnim.stopAnimation();
      };
    }
  }, [selectedLocation, locationPreviewPresented, progressAnim]);

  // Load recent locations from AsyncStorage
  const loadRecentLocations = async () => {
    try {
      setIsLoadingRecent(true);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const locations: RecentLocation[] = JSON.parse(stored);
        // Filter locations from last 30 days and sort by most recent
        const now = Date.now();
        const thirtyDaysAgo = now - MAX_RECENT_DAYS * 24 * 60 * 60 * 1000;
        const filtered = locations
          .filter((loc) => loc.timestamp >= thirtyDaysAgo)
          .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
        setRecentLocations(filtered);
        
        // Update storage with filtered locations
        if (filtered.length !== locations.length) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        }
      }
    } catch (error) {
      console.error('Error loading recent locations:', error);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  // Save location to recent locations
  const saveRecentLocation = useCallback(async (locationText: string) => {
    try {
      // Parse location text to extract address, city, zipCode
      // Format: "address, city zipCode" or "full address"
      const parts = locationText.split(',').map((p) => p.trim());
      let address = parts[0] || locationText;
      let city = '';
      let zipCode = '';

      if (parts.length > 1) {
        // Try to extract city and zipCode from remaining parts
        const lastPart = parts[parts.length - 1];
        const zipMatch = lastPart.match(/(\d{5,6})/);
        if (zipMatch) {
          zipCode = zipMatch[1];
          city = lastPart.replace(zipCode, '').trim();
        } else {
          city = lastPart;
        }
        // Reconstruct address from all parts except last
        if (parts.length > 2) {
          address = parts.slice(0, -1).join(', ');
        }
      }

      const newLocation: RecentLocation = {
        id: `recent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        address: address,
        city: city,
        zipCode: zipCode,
        timestamp: Date.now(),
      };

      // Get existing locations
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      let locations: RecentLocation[] = stored ? JSON.parse(stored) : [];

      // Remove duplicate (same address) and add new one at the beginning
      locations = locations.filter(
        (loc) => loc.address.toLowerCase() !== newLocation.address.toLowerCase()
      );
      locations.unshift(newLocation); // Add to beginning

      // Keep only last MAX_RECENT_LOCATIONS
      locations = locations.slice(0, MAX_RECENT_LOCATIONS);

      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
      
      // Update state
      setRecentLocations(locations);
    } catch (error) {
      console.error('Error saving recent location:', error);
    }
  }, []);

  const displayedRecentLocations = showAllRecent
    ? recentLocations
    : recentLocations.slice(0, 3);

  // Load saved addresses from backend API
  const loadSavedAddresses = useCallback(async () => {
    if (!userId) return;
    
    try {
      setIsLoadingSaved(true);
      const response = await fetch(`${API_BASE_URL_WITH_API}/profile/saved-addresses/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Convert API addresses to RecentLocation format
          const addresses: RecentLocation[] = result.data.map((addr: any, index: number) => ({
            id: `saved-${index}-${addr._id || Date.now()}`,
            address: addr.address || '',
            city: addr.city || '',
            zipCode: addr.zipCode || '',
            timestamp: addr.createdAt ? new Date(addr.createdAt).getTime() : Date.now(),
          }));
          setSavedAddresses(addresses);
        }
      } else {
        console.warn('Failed to fetch saved addresses');
      }
    } catch (error) {
      console.error('Error loading saved addresses:', error);
    } finally {
      setIsLoadingSaved(false);
    }
  }, [userId]);

  // Geocode address to get coordinates using Google Maps Geocoding API
  const geocodeAddress = useCallback(async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?` +
          `address=${encodeURIComponent(address)}` +
          `&components=country:IN` +
          `&key=${GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        console.warn('Geocoding failed:', response.status);
        return null;
      }

      const data = await response.json();
      if (data.status === 'OK' && data.results?.length > 0) {
        const location = data.results[0].geometry?.location;
        const lat = parseFloat(location?.lat);
        const lon = parseFloat(location?.lng);
        if (!isNaN(lat) && !isNaN(lon)) {
          console.log('✅ Geocoded address:', address, '->', lat, lon);
          return { latitude: lat, longitude: lon };
        }
      } else if (data.status !== 'ZERO_RESULTS') {
        console.warn('Google geocoding failed:', data.status, data.error_message);
      }
      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  }, []);

  // Save address to backend API with coordinates
  const saveAddressToBackend = useCallback(async (
    address: string,
    city: string,
    zipCode: string,
    latitude?: number,
    longitude?: number
  ) => {
    if (!userId) return;

    try {
      // If coordinates not provided, try to geocode the address
      let finalLat = latitude;
      let finalLon = longitude;

      if ((!finalLat || !finalLon) && address) {
        const fullAddress = [address, city, zipCode].filter(Boolean).join(', ');
        console.log('📍 Geocoding address:', fullAddress);
        const coords = await geocodeAddress(fullAddress);
        if (coords) {
          finalLat = coords.latitude;
          finalLon = coords.longitude;
        }
      }

      const response = await fetch(`${API_BASE_URL_WITH_API}/profile/saved-addresses/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          address: address.trim(),
          city: city.trim(),
          zipCode: zipCode.trim(),
          latitude: finalLat,
          longitude: finalLon,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Reload saved addresses
          await loadSavedAddresses();
        }
      }
    } catch (error) {
      console.error('Error saving address to backend:', error);
    }
  }, [geocodeAddress, loadSavedAddresses, userId]);

  // Update profile location with coordinates
  const updateProfileLocation = useCallback(async (
    address: string,
    latitude?: number,
    longitude?: number
  ) => {
    if (!userId) return;

    try {
      // If coordinates not provided, try to geocode the address
      let finalLat = latitude;
      let finalLon = longitude;

      if ((!finalLat || !finalLon) && address) {
        console.log('📍 Geocoding profile location:', address);
        const coords = await geocodeAddress(address);
        if (coords) {
          finalLat = coords.latitude;
          finalLon = coords.longitude;
        }
      }

      const response = await fetch(`${API_BASE_URL_WITH_API}/profile/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userId,
          location: {
            address: address,
            latitude: finalLat || 0,
            longitude: finalLon || 0,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Profile location updated:', result);
      } else {
        console.warn('Failed to update profile location');
      }
    } catch (error) {
      console.error('Error updating profile location:', error);
    }
  }, [geocodeAddress, userId]);

  // Update profile salon work location
  const updateProfileSalonWorkLocation = useCallback(async (
    address: string
  ) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/profile/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userId,
          salonWorkLocation: address,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Salon work location updated:', result);
      } else {
        console.warn('Failed to update salon work location');
      }
    } catch (error) {
      console.error('Error updating salon work location:', error);
    }
  }, [userId]);

  const getAddressComponent = (components: any[] = [], type: string) =>
    components.find((component) => component.types?.includes(type))?.long_name || '';

  const fetchGooglePlaceDetails = async (
    placeId: string
  ): Promise<SearchResult | null> => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?` +
          `place_id=${encodeURIComponent(placeId)}` +
          `&fields=formatted_address,geometry,address_components,name` +
          `&key=${GOOGLE_MAPS_API_KEY}`
      );

      const data = await response.json();

      if (data.status !== 'OK' || !data.result) {
        console.warn('Google place details failed:', data.status, data.error_message);
        return null;
      }

      const result = data.result;
      const streetNumber = getAddressComponent(result.address_components, 'street_number');
      const route = getAddressComponent(result.address_components, 'route');
      const subpremise = getAddressComponent(result.address_components, 'subpremise');
      const premise = getAddressComponent(result.address_components, 'premise');
      const sublocality =
        getAddressComponent(result.address_components, 'sublocality_level_1') ||
        getAddressComponent(result.address_components, 'sublocality') ||
        getAddressComponent(result.address_components, 'neighborhood');
      const city =
        getAddressComponent(result.address_components, 'locality') ||
        sublocality ||
        getAddressComponent(result.address_components, 'administrative_area_level_3') ||
        getAddressComponent(result.address_components, 'administrative_area_level_2') ||
        result.name ||
        '';
      const state = getAddressComponent(
        result.address_components,
        'administrative_area_level_1'
      );
      const zipCode = getAddressComponent(result.address_components, 'postal_code');
      const location = result.geometry?.location;

      // Clean street/building part
      const streetParts = [subpremise, premise, streetNumber, route]
        .filter(Boolean)
        .join(' ');
      const detailedStreet = streetParts || sublocality || result.name || '';

      return {
        id: placeId,
        placeId,
        address: result.formatted_address || result.name || city,
        city,
        state,
        zipCode,
        lat: location?.lat?.toString(),
        lon: location?.lng?.toString(),
        type: 'api',
      };
    } catch (err) {
      console.log('Google place details error:', err);
      return null;
    }
  };

  const fetchGoogleAutocompleteResults = async (
    query: string,
    type?: 'geocode' | 'address' | 'establishment'
  ): Promise<SearchResult[]> => {
    try {
      const typeParam = type ? `&types=${type}` : '';
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
          `input=${encodeURIComponent(query)}` +
          typeParam +
          `&components=country:in` +
          `&region=in` +
          `&language=en` +
          `&key=${GOOGLE_MAPS_API_KEY}`
      );
  
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn(
          `Google autocomplete${type ? ` ${type}` : ''} search failed:`,
          data.status,
          data.error_message
        );
        return [];
      }

      if (data.status === 'ZERO_RESULTS') {
        return [];
      }
  
      return (data.predictions || []).slice(0, 5).map((item: any) => ({
        id: item.place_id,
        placeId: item.place_id,
        address: item.description,
        city: item.structured_formatting?.main_text || item.terms?.[0]?.value || '',
        zipCode: '',
        state:
          item.terms?.length > 1
            ? item.terms[item.terms.length - 2]?.value
            : '',
        type: 'api',
      }));
    } catch (err) {
      console.log(`Google autocomplete${type ? ` ${type}` : ''} search error:`, err);
      return [];
    }
  };

  const fetchGoogleGeocodeSearchResults = async (query: string): Promise<SearchResult[]> => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?` +
          `address=${encodeURIComponent(query)}` +
          `&components=country:IN` +
          `&region=in` +
          `&key=${GOOGLE_MAPS_API_KEY}`
      );

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn('Google exact geocode search failed:', data.status, data.error_message);
        return [];
      }

      if (data.status === 'ZERO_RESULTS') {
        return [];
      }

      return (data.results || []).slice(0, 5).map((item: any, index: number) => {
        const components = item.address_components || [];
        const city =
          getAddressComponent(components, 'locality') ||
          getAddressComponent(components, 'sublocality_level_1') ||
          getAddressComponent(components, 'administrative_area_level_3') ||
          getAddressComponent(components, 'administrative_area_level_2') ||
          '';
        const state = getAddressComponent(components, 'administrative_area_level_1');
        const zipCode = getAddressComponent(components, 'postal_code');
        const location = item.geometry?.location;

        return {
          id: item.place_id || `geocode-${index}-${item.formatted_address}`,
          placeId: item.place_id,
          address: item.formatted_address || query,
          city,
          state,
          zipCode,
          lat: location?.lat?.toString(),
          lon: location?.lng?.toString(),
          type: 'api',
        };
      });
    } catch (err) {
      console.log('Google exact geocode search error:', err);
      return [];
    }
  };

  const dedupeSearchResults = (results: SearchResult[]): SearchResult[] => {
    const seen = new Set<string>();

    return results.filter((result) => {
      const key = result.placeId || result.address.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  // Keep live search lightweight. Details/geocoding are fetched only after selection.
  const fetchLocationSearchResults = async (query: string): Promise<SearchResult[]> => {
    const searchTypes: Array<'geocode' | 'address' | 'establishment'> = [
      'geocode',
      'address',
      'establishment',
    ];
    const [exactResults, ...autocompleteGroups] = await Promise.all([
      fetchGoogleGeocodeSearchResults(query),
      ...searchTypes.map(type => fetchGoogleAutocompleteResults(query, type)),
    ]);

    return dedupeSearchResults([
      ...exactResults,
      ...autocompleteGroups.flat(),
    ]).slice(0, MAX_SEARCH_RESULTS);
  };
  

  // Debounced search effect - calls API when user types
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      const trimmedQuery = searchQuery.trim();

      if (trimmedQuery.length >= MIN_SEARCH_QUERY_LENGTH) {
        setIsSearching(true);
        setSearchError(null);
        try {
          const results = await fetchLocationSearchResults(trimmedQuery);
          setApiResults(results);
        } catch (error) {
          console.log('Location search failed:', error);
          setApiResults([]);
          setSearchError('Unable to search locations right now');
        } finally {
          setIsSearching(false);
        }
      } else {
        setApiResults([]);
        setSearchError(null);
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(delayDebounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Use API results for search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    return [...apiResults].slice(0, MAX_SEARCH_RESULTS);
  }, [apiResults, searchQuery]);

  const shouldShowSearchOverlay =
    searchQuery.trim().length > 0 || isSearchFocused;

  const searchResultsPanelStyle = useMemo(
    () =>
      StyleSheet.create({
        dynamicSearchResultsContainer: {
          height: searchQuery.trim().length === 0
            ? Math.min(
                Math.max(displayedRecentLocations.length * 72 + 88, 140),
                420
              )
            : isSearching
              ? 72
              : Math.min(Math.max(searchResults.length * 72 + 12, 96), 420),
        },
      }).dynamicSearchResultsContainer,
    [displayedRecentLocations.length, isSearching, searchQuery, searchResults.length]
  );

  // Request location permission (same approach as frontend)
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      let permissionResult;

      if (Platform.OS === 'android') {
        // First check if permission is already granted
        const checkResult = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        
        if (checkResult === RESULTS.GRANTED) {
          console.log('Location permission already granted');
          return true;
        }

        // Request for Android (Fine location)
        permissionResult = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      } else {
        // First check if permission is already granted
        const checkResult = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        
        if (checkResult === RESULTS.GRANTED) {
          console.log('Location permission already granted');
          return true;
        }

        // Request for iOS (Location when using app)
        permissionResult = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
      }

      if (permissionResult === RESULTS.GRANTED) {
        console.log('Location permission granted');
        return true;
      } else if (permissionResult === RESULTS.DENIED) {
        console.log('Location permission denied');
        return false;
      } else if (permissionResult === RESULTS.BLOCKED) {
        Alert.alert(
          'Location Permission Required',
          'Location permission is required for better service experience. Please enable it from settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }, []);

  const shouldShowLocationPermissionPrompt = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {
      const checkResult = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
      return checkResult !== RESULTS.GRANTED;
    } catch (error) {
      console.error('Error checking location permission:', error);
      return true;
    }
  }, []);

  const buildParsedAddress = useCallback((result: any, fallbackAddress: string): ParsedAddress => {
    const components = result?.address_components || [];
    const streetNumber = getAddressComponent(components, 'street_number');
    const route = getAddressComponent(components, 'route');
    const neighborhood = getAddressComponent(components, 'neighborhood');
    const sublocality =
      getAddressComponent(components, 'sublocality_level_1') ||
      getAddressComponent(components, 'sublocality');
    const city =
      getAddressComponent(components, 'locality') ||
      getAddressComponent(components, 'administrative_area_level_3') ||
      getAddressComponent(components, 'administrative_area_level_2') ||
      '';
    const state = getAddressComponent(components, 'administrative_area_level_1');
    const zipCode = getAddressComponent(components, 'postal_code');
    const address = [streetNumber, route, neighborhood || sublocality]
      .filter(Boolean)
      .join(', ');

    return {
      address: address || result?.formatted_address || fallbackAddress,
      city: city || state,
      zipCode,
      formattedAddress: result?.formatted_address || fallbackAddress,
    };
  }, []);

  // Reverse geocode coordinates to address using Google Maps Geocoding API
  const reverseGeocodeDetails = useCallback(async (
    latitude: number,
    longitude: number
  ): Promise<ParsedAddress> => {
    const fallbackAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?` +
          `latlng=${latitude},${longitude}` +
          `&key=${GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }

      const data = await response.json();
      if (data.status === 'OK' && data.results?.length > 0) {
        return buildParsedAddress(data.results[0], fallbackAddress);
      }

      throw new Error(data.error_message || data.status || 'Reverse geocoding failed');
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return {
        address: fallbackAddress,
        city: '',
        zipCode: '',
        formattedAddress: fallbackAddress,
      };
    }
  }, [buildParsedAddress]);

  const reverseGeocode = useCallback(async (latitude: number, longitude: number): Promise<string> => {
    const parsed = await reverseGeocodeDetails(latitude, longitude);
    return parsed.formattedAddress;
  }, [reverseGeocodeDetails]);

  const getFastPosition = useCallback((): Promise<Geolocation.GeoPosition> => {
    return new Promise((resolve, reject) => {
      // 1. Try high accuracy position first with a quick 5s timeout
      Geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err1) => {
          console.warn('High accuracy location timeout/error, trying fallback network location:', err1?.message || err1);
          // 2. Fallback to network/wifi/cell position (enableHighAccuracy: false) which resolves instantly
          Geolocation.getCurrentPosition(
            (pos2) => resolve(pos2),
            (err2) => reject(err2),
            {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 60000,
              ...(Platform.OS === 'android' ? { showLocationDialog: true } : {}),
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 30000,
          ...(Platform.OS === 'android' ? { showLocationDialog: true } : {}),
        }
      );
    });
  }, []);

  const startCurrentLocationLookup = useCallback(async () => {
    if (selectedLocation) return;

    try {
      setIsGettingLocation(true);
      setCurrentLocationAddress(null);
      setIsResolvingMapAddress(true);
      setMapSelectedAddress(null);

      // Request location permission after the user sees the in-app rationale.
      const permissionGranted = await requestLocationPermission();

      if (!permissionGranted) {
        setIsGettingLocation(false);
        setIsResolvingMapAddress(false);
        Alert.alert(
          'Permission Required',
          'Location permission is required to get your current address. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      const position = await getFastPosition();
      const { latitude, longitude } = position.coords;
      console.log('Location fetched successfully:', { latitude, longitude });

      focusMapOnCoordinate(latitude, longitude, USER_LOCATION_MAP_DELTA, true, true);
      setCurrentLocationAddress('Getting address...');

      try {
        const address = await reverseGeocode(latitude, longitude);
        console.log('Current address:', address);

        setCurrentLocationAddress(address);
        setMapSelectedAddress(address);
        setIsGettingLocation(false);
        setIsResolvingMapAddress(false);

        await saveRecentLocation(address);

        if (userId) {
          const parts = address.split(',').map((p) => p.trim());
          const addr = parts[0] || address;
          const city = parts.length > 1 ? parts[1] : '';
          const zipCode = parts.length > 2 ? parts[2].match(/\d{5,6}/)?.[0] || '' : '';
          await saveAddressToBackend(addr, city, zipCode, latitude, longitude);
          await updateProfileLocation(address, latitude, longitude);
        }
      } catch (geocodeError) {
        console.error('Reverse geocoding error:', geocodeError);
        const coordinateAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setCurrentLocationAddress(coordinateAddress);
        setMapSelectedAddress(coordinateAddress);
        setIsGettingLocation(false);
        setIsResolvingMapAddress(false);

        await saveRecentLocation(coordinateAddress);
      }
    } catch (error: any) {
      console.error('Location error:', error);
      setIsGettingLocation(false);
      setIsResolvingMapAddress(false);

      let errorMessage = 'Unable to fetch your location.';
      if (error?.code === 1) {
        errorMessage = 'Permission denied. Please enable location access in settings.';
      } else if (error?.code === 2) {
        errorMessage = 'Location unavailable. Please check your GPS settings.';
      } else if (error?.code === 3) {
        errorMessage = 'Location timeout. Try again with GPS ON.';
      }

      Alert.alert('Location Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsGettingLocation(false);
      setIsResolvingMapAddress(false);
    }
  }, [getFastPosition, requestLocationPermission, reverseGeocode, saveRecentLocation, saveAddressToBackend, selectedLocation, updateProfileLocation, userId]);

  const focusMapOnCoordinate = (
    latitude: number,
    longitude: number,
    delta = 0.01,
    keepAboveBottomSheet = false,
    isCurrentLocation = false,
  ) => {
    const coordinate = { latitude, longitude };
    const centerLatitude = keepAboveBottomSheet
      ? latitude - delta * CURRENT_LOCATION_VIEW_OFFSET_RATIO
      : latitude;
    const nextRegion = {
      latitude: centerLatitude,
      longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
    setMapMarker(coordinate);
    setIsCurrentLocationPin(isCurrentLocation);
    setMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 350);
  };

  const handleMapZoom = (direction: 'in' | 'out') => {
    const nextLatitudeDelta =
      direction === 'in'
        ? Math.max(mapRegion.latitudeDelta * MAP_ZOOM_FACTOR, MIN_MAP_DELTA)
        : Math.min(mapRegion.latitudeDelta / MAP_ZOOM_FACTOR, MAX_MAP_DELTA);
    const nextLongitudeDelta =
      direction === 'in'
        ? Math.max(mapRegion.longitudeDelta * MAP_ZOOM_FACTOR, MIN_MAP_DELTA)
        : Math.min(mapRegion.longitudeDelta / MAP_ZOOM_FACTOR, MAX_MAP_DELTA);
    const nextRegion = {
      ...mapRegion,
      latitudeDelta: nextLatitudeDelta,
      longitudeDelta: nextLongitudeDelta,
    };

    setMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 250);
  };

  const handleMapPress = async (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    focusMapOnCoordinate(latitude, longitude);
    setIsResolvingMapAddress(true);
    setMapSelectedAddress(null);

    try {
      const parsedAddress = await reverseGeocodeDetails(latitude, longitude);
      setMapSelectedAddress(parsedAddress.formattedAddress);
      setCurrentLocationAddress(parsedAddress.formattedAddress);
    } finally {
      setIsResolvingMapAddress(false);
    }
  };

  const handleUsePinnedLocation = async () => {
    if (!mapMarker) return;

    setIsResolvingMapAddress(true);
    try {
      const parsedAddress = await reverseGeocodeDetails(
        mapMarker.latitude,
        mapMarker.longitude
      );
      setManualAddress(parsedAddress.address);
      setManualCity(parsedAddress.city);
      setManualZipCode(parsedAddress.zipCode);
      setManualFloor('');
      setManualDetails('');
      setManualCoordinate(mapMarker);
      setMapSelectedAddress(parsedAddress.formattedAddress);
      setCurrentLocationAddress(parsedAddress.formattedAddress);
      setShowAddAddressModal(true);
    } finally {
      setIsResolvingMapAddress(false);
    }
  };

  const handleCurrentLocation = useCallback(async () => {
    if (selectedLocation) return;

    if (Platform.OS === 'ios' && !hasShownLocationPermissionPrompt.current) {
      const shouldShowPrompt = await shouldShowLocationPermissionPrompt();
      if (shouldShowPrompt) {
        setShowLocationPermissionModal(true);
        return;
      }
      hasShownLocationPermissionPrompt.current = true;
    }

    await startCurrentLocationLookup();
  }, [selectedLocation, shouldShowLocationPermissionPrompt, startCurrentLocationLookup]);

  useEffect(() => {
    handleCurrentLocationRef.current = handleCurrentLocation;
  }, [handleCurrentLocation]);

  const handleConfirmLocationPermission = useCallback(async () => {
    setShowLocationPermissionModal(false);
    hasShownLocationPermissionPrompt.current = true;
    await startCurrentLocationLookup();
  }, [startCurrentLocationLookup]);

  const handleDismissLocationPermission = useCallback(() => {
    setShowLocationPermissionModal(false);
  }, []);
  

  const handleLocationSelect = async (location: RecentLocation) => {
    if (selectedLocation) return;

    console.log('Location selected:', location);
    const locationText = `${location.address}, ${location.city} ${location.zipCode}`.trim();
    
    // Update timestamp for this location (move to top of recent)
    await saveRecentLocation(locationText);

    setCurrentLocationAddress(locationText);
    setMapSelectedAddress(locationText);

    const coordinates = await geocodeAddress(locationText);
    if (coordinates) {
      focusMapOnCoordinate(coordinates.latitude, coordinates.longitude);
    }
  };

  const handleSearchResultSelect = async (result: SearchResult) => {
    console.log('Search result selected:', result);
    const resolvedResult = result.placeId
      ? (await fetchGooglePlaceDetails(result.placeId)) || result
      : result;

    // Use the full display_name from API or construct from parts
    const locationText = resolvedResult.address || 
      `${resolvedResult.city || ''}${resolvedResult.state ? `, ${resolvedResult.state}` : ''}${resolvedResult.zipCode ? ` ${resolvedResult.zipCode}` : ''}`.trim();
    
    // Get coordinates from search result (if available)
    let latitude = resolvedResult.lat ? parseFloat(resolvedResult.lat) : undefined;
    let longitude = resolvedResult.lon ? parseFloat(resolvedResult.lon) : undefined;

    if (
      (typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        isNaN(latitude) ||
        isNaN(longitude)) &&
      locationText
    ) {
      const coordinates = await geocodeAddress(locationText);
      latitude = coordinates?.latitude;
      longitude = coordinates?.longitude;
    }

    if (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !isNaN(latitude) &&
      !isNaN(longitude)
    ) {
      focusMapOnCoordinate(latitude, longitude);
    }

    setMapSelectedAddress(locationText);
    setCurrentLocationAddress(locationText);
    setSearchQuery('');
    setIsSearchFocused(false);
    searchInputRef.current?.blur();

    // Populate the full address fields so total location is filled
    setManualAddress(resolvedResult.address || locationText);
    setManualCity(resolvedResult.city || '');
    setManualZipCode(resolvedResult.zipCode || '');
    setManualFloor('');
    setManualDetails('');
    if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
      setManualCoordinate({ latitude, longitude });
    } else {
      setManualCoordinate(null);
    }
    // Open confirmation address modal with full details pre-filled
    setShowAddAddressModal(true);
  };

  const handleSearchSubmit = async () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < MIN_SEARCH_QUERY_LENGTH) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const [firstResult] = await fetchLocationSearchResults(trimmedQuery);
      if (firstResult) {
        await handleSearchResultSelect(firstResult);
      } else {
        setApiResults([]);
        setSearchError('No exact address found');
      }
    } catch (error) {
      console.log('Exact address search failed:', error);
      setSearchError('Unable to search locations right now');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearAll = async () => {
    try {
      Alert.alert(
        'Clear All Recent Locations',
        'Are you sure you want to clear all recent locations?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Clear All',
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.removeItem(STORAGE_KEY);
              setRecentLocations([]);
              console.log('All recent locations cleared');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error clearing recent locations:', error);
      Alert.alert('Error', 'Failed to clear recent locations');
    }
  };

  const handleShowAll = () => {
    setShowAllRecent(!showAllRecent);
  };

  const handleAddAddress = () => {
    console.log('Add Address button clicked - opening modal');
    setManualCoordinate(null);
    setShowAddAddressModal(true);
  };

  const handleSaveManualAddress = async () => {
    if (isSavingManualAddress || selectedLocation) {
      return;
    }

    if (!manualAddress.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }

    setIsSavingManualAddress(true);

    try {
      const addressForSave = [manualFloor, manualAddress, manualDetails]
        .filter((part) => part.trim())
        .join(', ')
        .trim();

      // Construct location text
      const locationText = [addressForSave, manualCity, manualZipCode]
        .filter(Boolean)
        .join(', ')
        .trim();

      // Save to recent locations (AsyncStorage)
      await saveRecentLocation(locationText);

      // Save to backend API if userId exists (will geocode if needed)
      if (userId) {
        await saveAddressToBackend(
          addressForSave,
          manualCity.trim(),
          manualZipCode.trim(),
          manualCoordinate?.latitude,
          manualCoordinate?.longitude
        );

        await updateProfileLocation(
          locationText,
          manualCoordinate?.latitude,
          manualCoordinate?.longitude
        );
      }

      // Close modal and clear inputs
      setShowAddAddressModal(false);
      setManualAddress('');
      setManualCity('');
      setManualZipCode('');
      setManualFloor('');
      setManualDetails('');
      setManualCoordinate(null);

      // Show selected location for 3 seconds before navigating
      setSelectedLocation(locationText);
    } finally {
      setIsSavingManualAddress(false);
    }
  };

  const handleCancelAddAddress = () => {
    setShowAddAddressModal(false);
    setManualAddress('');
    setManualCity('');
    setManualZipCode('');
    setManualFloor('');
    setManualDetails('');
    setManualCoordinate(null);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <Modal
        visible={showLocationPermissionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDismissLocationPermission}>
        <View style={styles.permissionModalOverlay}>
          <View style={styles.permissionModalCard}>
            <View style={styles.permissionModalIconWrap}>
              <Icon name="location-on" size={30} color={PRIMARY_COLOR} />
            </View>
            <Text style={styles.permissionModalTitle}>Allow Location Access</Text>
            <Text style={styles.permissionModalText}>
              We use your location to find nearby services, support home-service booking,
              and keep your profile address accurate. You can change this later in Settings.
            </Text>
            <View style={styles.permissionModalButtons}>
              <TouchableOpacity
                style={styles.permissionModalSecondaryButton}
                onPress={handleDismissLocationPermission}
                activeOpacity={0.8}>
                <Text style={styles.permissionModalSecondaryButtonText}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionModalPrimaryButton}
                onPress={handleConfirmLocationPermission}
                activeOpacity={0.8}>
                <Text style={styles.permissionModalPrimaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.fullScreenMap}
        initialRegion={mapRegion}
        mapType="standard"
        mapPadding={{ top: 120, right: 16, bottom: 260, left: 16 }}
        loadingEnabled={true}
        // Keep the map interactive, but avoid optional map layers and continuous GPS updates.
        moveOnMarkerPress={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={true}
        zoomEnabled={true}
        showsBuildings={false}
        showsIndoors={false}
        showsPointsOfInterests={false}
        showsTraffic={false}
        minZoomLevel={3}
        maxZoomLevel={20}
        onMapReady={() => {
          if (!hasRequestedInitialLocation.current) {
            hasRequestedInitialLocation.current = true;
            handleCurrentLocation();
          }
        }}
        onRegionChangeComplete={(region) => setMapRegion(region)}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onPress={handleMapPress}>
        {mapMarker && (
          <Marker
            coordinate={mapMarker}
            title={isCurrentLocationPin ? 'Current location' : 'Selected location'}
            description={mapSelectedAddress || 'Pinned location'}
          />
        )}
      </MapView>

      <View style={styles.mapZoomControls}>
        <TouchableOpacity
          style={styles.mapZoomButton}
          onPress={() => handleMapZoom('in')}
          activeOpacity={0.75}>
          <Icon name="add" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.mapZoomDivider} />
        <TouchableOpacity
          style={styles.mapZoomButton}
          onPress={() => handleMapZoom('out')}
          activeOpacity={0.75}>
          <Icon name="remove" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.topOverlay,
          {
            paddingTop: Math.max(
              insets.top + TOP_OVERLAY_EXTRA_PADDING,
              compactTopPadding(16)
            ),
          },
        ]}>
        <View style={styles.topOverlayMain}>
          <View style={styles.topOverlayRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}>
              <Icon name="arrow-back" size={24} color={PRIMARY_COLOR} />
            </TouchableOpacity>

            <View style={styles.searchBar}>
              <Icon name="search" size={22} color={PRIMARY_COLOR} style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search current service location"
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
              />
              {(searchQuery.length > 0 || isSearchFocused) && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setSearchQuery('');
                    setIsSearchFocused(false);
                    searchInputRef.current?.blur();
                  }}
                  activeOpacity={0.7}>
                  <Icon name="close" size={20} color="#777" />
                </TouchableOpacity>
              )}
            </View>

            {onSkip && (
              <TouchableOpacity
                style={styles.headerSkipButton}
                onPress={onSkip}
                activeOpacity={0.7}>
                <Text style={styles.headerSkipButtonText}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {shouldShowSearchOverlay &&
        (searchQuery.trim().length === 0 || isSearching || searchResults.length > 0) && (
        <View
          style={[
            styles.searchResultsContainer,
            searchResultsPanelStyle,
          ]}>
          {searchQuery.trim().length === 0 ? (
            <ScrollView
              style={styles.searchResultsScroll}
              contentContainerStyle={styles.searchResultsContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={displayedRecentLocations.length > 4}
              keyboardShouldPersistTaps="handled">
              <Text style={styles.searchOverlayTitle}>Recent</Text>
              {isLoadingRecent ? (
                <View style={styles.loadingRecentContainer}>
                  <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                  <Text style={styles.loadingRecentText}>Loading recent locations...</Text>
                </View>
              ) : displayedRecentLocations.length > 0 ? (
                <>
                  {displayedRecentLocations.map((location) => (
                    <TouchableOpacity
                      key={location.id}
                      style={styles.searchResultItem}
                      onPress={() => {
                        setIsSearchFocused(false);
                        handleLocationSelect(location);
                      }}
                      activeOpacity={0.7}>
                      <Icon name="access-time" size={20} color="#999" style={styles.searchResultIcon} />
                      <View style={styles.locationDetails}>
                        <Text style={styles.locationAddress} numberOfLines={2}>
                          {location.address}
                        </Text>
                        <Text style={styles.locationCity}>
                          {location.city} {location.zipCode}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  <View style={styles.actionRow}>
                    {recentLocations.length > 0 && (
                      <TouchableOpacity
                        style={styles.clearAllButton}
                        onPress={handleClearAll}
                        activeOpacity={0.7}>
                        <Text style={styles.clearAllText}>Clear All</Text>
                      </TouchableOpacity>
                    )}

                    {recentLocations.length > 3 && (
                      <TouchableOpacity
                        style={styles.showAllButton}
                        onPress={handleShowAll}
                        activeOpacity={0.7}>
                        <Text style={styles.showAllText}>Show All</Text>
                        <Icon
                          name={showAllRecent ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                          size={20}
                          color={PRIMARY_COLOR}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.emptyRecentContainer}>
                  <Icon name="access-time" size={48} color="#E0E0E0" />
                  <Text style={styles.emptyRecentText}>No recent locations</Text>
                </View>
              )}
            </ScrollView>
          ) : isSearching ? (
            <View style={styles.searchingContainer}>
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
              <Text style={styles.searchingText}>Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <ScrollView
              style={styles.searchResultsScroll}
              contentContainerStyle={styles.searchResultsContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={searchResults.length > 5}
              keyboardShouldPersistTaps="handled">
              {searchResults.map((result) => (
                <TouchableOpacity
                  key={result.id}
                  style={styles.searchResultItem}
                  onPress={() => handleSearchResultSelect(result)}
                  activeOpacity={0.7}>
                  <Icon name="place" size={20} color={PRIMARY_COLOR} style={styles.searchResultIcon} />
                  <View style={styles.locationDetails}>
                    <Text style={styles.locationAddress} numberOfLines={2}>
                      {result.address}
                    </Text>
                    {(result.city || result.state || result.zipCode) && (
                      <Text style={styles.locationCity}>
                        {[result.city, result.state, result.zipCode]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>
      )}

      {searchQuery.trim().length === 0 && !isSearchFocused && (
        <View
          style={[
            styles.bottomSheet,
            { paddingBottom: Math.max(insets.bottom + 16, 24) },
          ]}>
          <View style={styles.sheetHandle} />
          {(isResolvingMapAddress || mapSelectedAddress) && (
            <View style={styles.mapInfoRow}>
              <View style={styles.mapInfoTextWrap}>
                <Text style={styles.mapTitle}>Select location</Text>
                <Text style={styles.mapAddressText} numberOfLines={2}>
                  {isResolvingMapAddress ? 'Getting address...' : mapSelectedAddress}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.usePinnedButton,
                  (!mapMarker || isResolvingMapAddress) && styles.usePinnedButtonDisabled,
                ]}
                onPress={handleUsePinnedLocation}
                activeOpacity={0.8}
                disabled={!mapMarker || isResolvingMapAddress}>
                <Icon name="check" size={18} color="#fff" />
                <Text style={styles.usePinnedButtonText}>Use</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.locationItem, isGettingLocation && styles.locationItemDisabled]}
              onPress={handleCurrentLocation}
              activeOpacity={0.7}
              disabled={isGettingLocation}>
              <View style={styles.locationIconContainer}>
                {isGettingLocation ? (
                  <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                ) : (
                  <Icon name="my-location" size={24} color={PRIMARY_COLOR} />
                )}
              </View>
              <View style={styles.locationDetails}>
                <Text style={styles.locationText}>
                  {isGettingLocation ? 'Getting location...' : 'Current Location'}
                </Text>
                {currentLocationAddress && !isGettingLocation && (
                  <Text style={styles.currentAddressText}>{currentLocationAddress}</Text>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.locationItem}
              onPress={handleAddAddress}
              activeOpacity={0.7}>
              <View style={styles.locationIconContainer}>
                <Icon name="add-location" size={24} color={PRIMARY_COLOR} />
              </View>
              <View style={styles.locationDetails}>
                <Text style={styles.locationText}>Add Address</Text>
                <Text style={styles.currentAddressText}>Enter address manually</Text>
              </View>
            </TouchableOpacity>

            {userId && (
              <TouchableOpacity
                style={styles.locationItem}
                onPress={() => {
                  setShowSavedAddressesModal(true);
                  loadSavedAddresses();
                }}
                activeOpacity={0.7}>
                <View style={styles.locationIconContainer}>
                  <Icon name="bookmark" size={24} color={PRIMARY_COLOR} />
                </View>
                <View style={styles.locationDetails}>
                  <Text style={styles.locationText}>
                    Saved Addresses {savedAddresses.length > 0 ? `(${savedAddresses.length})` : ''}
                  </Text>
                  <Text style={styles.currentAddressText}>Choose from saved addresses</Text>
                </View>
                <Icon name="chevron-right" size={24} color="#666" />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* Show message when searching but no results (only when not searching) */}
      {searchQuery.trim().length >= MIN_SEARCH_QUERY_LENGTH &&
        !isSearching &&
        searchResults.length === 0 && (
        <View style={styles.noResultsContainer}>
          <Icon name="search-off" size={48} color="#E0E0E0" />
          <Text style={styles.noResultsText}>
            {searchError || 'No locations found'}
          </Text>
          <Text style={styles.noResultsSubtext}>
            {searchError ? 'Please try again in a moment' : 'Try a different search term'}
          </Text>
        </View>
      )}

      {/* Selected Location Preview Modal */}
      <Modal
        visible={selectedLocation !== null}
        onActiveChange={setLocationPreviewPresented}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.checkmarkContainer}>
              <Icon name="check-circle" size={64} color="#4CAF50" />
            </View>
            <Text style={styles.modalTitle}>
              Current Service Location Selected
            </Text>
            <Text style={styles.modalLocation} numberOfLines={3}>
              {selectedLocation}
            </Text>
            <View style={styles.loadingBarContainer}>
              <Animated.View
                style={[
                  styles.loadingBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.modalSubtext}>
              Redirecting...
            </Text>
          </View>
        </View>
      </Modal>

      {/* Saved Addresses Modal */}
      <Modal
        visible={showSavedAddressesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSavedAddressesModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.addAddressModalContent}>
            {/* Header */}
            <View style={styles.addAddressHeader}>
              <Text style={styles.addAddressTitle}>Saved Addresses</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowSavedAddressesModal(false)}
                activeOpacity={0.7}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Saved Addresses List */}
            <ScrollView style={styles.addAddressScrollView} contentContainerStyle={styles.addAddressScrollContent} showsVerticalScrollIndicator={false}>
              {isLoadingSaved ? (
                <View style={styles.loadingRecentContainer}>
                  <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                  <Text style={styles.loadingRecentText}>Loading saved addresses...</Text>
                </View>
              ) : savedAddresses.length > 0 ? (
                savedAddresses.map((location) => (
                  <TouchableOpacity
                    key={location.id}
                    style={styles.locationItem}
                    onPress={() => {
                      handleLocationSelect(location);
                      setShowSavedAddressesModal(false);
                    }}
                    activeOpacity={0.7}>
                    <Icon name="bookmark" size={20} color={PRIMARY_COLOR} style={styles.clockIcon} />
                    <View style={styles.locationDetails}>
                      <Text style={styles.locationAddress}>{location.address}</Text>
                      <Text style={styles.locationCity}>
                        {location.city} {location.zipCode}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={20} color="#999" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyRecentContainer}>
                  <Icon name="bookmark-border" size={64} color="#E0E0E0" />
                  <Text style={styles.emptyRecentText}>No saved addresses yet</Text>
                  <Text style={styles.emptyRecentSubtext}>
                    Your saved addresses will appear here
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Address Manually Modal */}
      <Modal
        visible={showAddAddressModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelAddAddress}>
        <View style={styles.modalOverlay}>
          <View style={styles.addAddressModalContent}>
            {/* Header */}
            <View style={styles.addAddressHeader}>
              <Text style={styles.addAddressTitle}>
                {manualCoordinate
                  ? 'Confirm Current Service Location'
                  : 'Add Address Manually'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCancelAddAddress}
                activeOpacity={0.7}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Form Content */}
            <ScrollView
              style={styles.addAddressScrollView}
              contentContainerStyle={[
                styles.addAddressScrollContent,
                { paddingBottom: Math.max(insets.bottom + 20, 28) },
              ]}
              keyboardShouldPersistTaps="handled">
              {/* Address Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Address *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your address"
                  placeholderTextColor="#999"
                  value={manualAddress}
                  onChangeText={setManualAddress}
                  multiline={true}
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Flat / House / Floor</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Flat no, house no, floor"
                  placeholderTextColor="#999"
                  value={manualFloor}
                  onChangeText={setManualFloor}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Landmark / Details</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Nearby landmark or delivery details"
                  placeholderTextColor="#999"
                  value={manualDetails}
                  onChangeText={setManualDetails}
                  multiline={true}
                  numberOfLines={2}
                />
              </View>

              {/* City Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter city"
                  placeholderTextColor="#999"
                  value={manualCity}
                  onChangeText={setManualCity}
                />
              </View>

              {/* Zip Code Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Zip Code</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter zip code"
                  placeholderTextColor="#999"
                  value={manualZipCode}
                  onChangeText={setManualZipCode}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!manualAddress.trim() || isSavingManualAddress) &&
                    styles.saveButtonDisabled,
                ]}
                onPress={handleSaveManualAddress}
                activeOpacity={0.8}
                disabled={!manualAddress.trim() || isSavingManualAddress}>
                {isSavingManualAddress ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Address</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fullScreenMap: {
    ...StyleSheet.absoluteFillObject,
  },
  mapZoomControls: {
    position: 'absolute',
    right: 16,
    top: 178,
    width: 44,
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 5,
  },
  mapZoomButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapZoomDivider: {
    height: 1,
    backgroundColor: '#ECECEC',
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF7F0',
  },
  showMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 4,
  },
  showMapButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topOverlayMain: {
    width: '100%',
    gap: 8,
  },
  topOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  dualLocationSegment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 4,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 20,
    gap: 6,
    backgroundColor: '#F5F5F5',
  },
  segmentTabActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  segmentTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  segmentTabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  wpBottomActions: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  wpActionButton: {
    flexDirection: 'row',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  wpActionButtonDisabled: {
    backgroundColor: '#FFCCA0',
  },
  wpActionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  wpWorkActionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  wpSkipWorkButton: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  wpSkipWorkButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  wpFinishButton: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wpFinishButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  headerSkipButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#FFE0C4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerSkipButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FFE0C4',
    paddingHorizontal: 12,
    minHeight: 46,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    marginRight: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  filterButton: {
    marginLeft: 8,
    padding: 4,
  },
  searchingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  searchingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 104,
    left: 16,
    right: 16,
    maxHeight: 420,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  searchResultsScroll: {
    flex: 1,
  },
  searchResultsContent: {
    paddingHorizontal: 16,
    paddingTop: compactTopPadding(8),
    paddingBottom: 8,
  },
  searchOverlayTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultIcon: {
    marginRight: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100, // Space for bottom nav
  },
  noResultsContainer: {
    position: 'absolute',
    top: 112,
    left: 16,
    right: 16,
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  mapSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0C4',
    overflow: 'hidden',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  map: {
    width: '100%',
    height: 220,
  },
  mapInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  mapInfoTextWrap: {
    flex: 1,
  },
  mapTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  mapAddressText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '48%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D8D8',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  usePinnedButton: {
    minWidth: 76,
    height: 40,
    borderRadius: 8,
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 4,
  },
  usePinnedButtonDisabled: {
    backgroundColor: '#D8D8D8',
  },
  usePinnedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  loadingRecentContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loadingRecentText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  emptyRecentContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyRecentSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  checkmarkContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLocation: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  loadingBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  loadingBar: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  permissionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  permissionModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
  },
  permissionModalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(253, 139, 54, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  permissionModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionModalText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#666',
    textAlign: 'center',
    marginBottom: 18,
  },
  permissionModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  permissionModalSecondaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#fff',
  },
  permissionModalSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  permissionModalPrimaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
  },
  permissionModalPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clockIcon: {
    marginRight: 12,
  },
  locationDetails: {
    flex: 1,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  locationItemDisabled: {
    opacity: 0.6,
  },
  currentAddressText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  locationCity: {
    fontSize: 14,
    color: '#666',
  },
  savedAddressesButton: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: 12,
    paddingHorizontal: 10,

    marginBottom: 36,
    marginTop: -16,

  },
  savedAddressesButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 12,
  },
  savedAddressesModalContent: {
    flex: 1,
    padding: 20,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: compactTopPadding(16),
  },
  clearAllButton: {
    paddingVertical: 8,
  },
  clearAllText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  showAllText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    marginRight: 4,
  },
  addAddressModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxHeight: '80%',
    position: 'absolute',
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  addAddressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipButtonText: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: '600',
  },
  addAddressTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  addAddressScrollView: {
    flex: 1,
  },
  addAddressScrollContent: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LocationSelectionScreen;
