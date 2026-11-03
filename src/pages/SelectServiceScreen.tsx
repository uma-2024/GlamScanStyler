import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from '../components/AppLinearGradient';
import { API_BASE_URL_WITH_API } from '../config/api';
import { GlamLoader } from '../components/GlamLoader';

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

interface SelectServiceScreenProps {
  onBack?: () => void;
  onServiceToggle?: (serviceId: string, isEnabled: boolean) => void;
  onNext?: (selectedMainCategoryIds: string[]) => void;
  onSkip?: () => void;
  selectedMainCategoryIds?: string[];
  onSelectionChange?: (selectedMainCategoryIds: string[]) => void;
  userId?: string;
}

const SelectServiceScreen: React.FC<SelectServiceScreenProps> = ({
  onBack,
  onServiceToggle: _onServiceToggle,
  onNext,
  onSkip,
  selectedMainCategoryIds = [],
  onSelectionChange,
  userId,
}) => {
  const [mainCategories, setMainCategories] = useState<IMainCategory[]>([]);
  const [selectedMainCategoryIdSet, setSelectedMainCategoryIdSet] = useState<Set<string>>(
    () => new Set(selectedMainCategoryIds),
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const mainCategoriesFetchedRef = useRef(false);

  useEffect(() => {
    fetchMainCategories();
  }, []);

  useEffect(() => {
    if (selectedMainCategoryIds && selectedMainCategoryIds.length > 0) {
      setSelectedMainCategoryIdSet(new Set(selectedMainCategoryIds));
    } else if (userId) {
      // Fetch user profile to check if main categories are already saved in DB
      fetch(`${API_BASE_URL_WITH_API}/profile/${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data?.success && Array.isArray(data.data?.mainCategoryIds) && data.data.mainCategoryIds.length > 0) {
            setSelectedMainCategoryIdSet(new Set(data.data.mainCategoryIds));
            onSelectionChange?.(data.data.mainCategoryIds);
          }
        })
        .catch(err => console.warn('Could not fetch saved mainCategoryIds:', err));
    }
  }, [selectedMainCategoryIds, userId]);

  const fetchMainCategories = async () => {
    if (mainCategoriesFetchedRef.current) {
      return;
    }

    try {
      setLoading(true);
      const endpoint = `${API_BASE_URL_WITH_API}/main-categories`;
      console.log('🔗 Fetching main categories from:', endpoint);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('❌ Failed to fetch main categories, status:', response.status);
        setMainCategories([]);
        return;
      }

      const result = await response.json();
      console.log('📥 Main categories response:', result);

      if (
        result.success &&
        result.data &&
        Array.isArray(result.data.mainCategories)
      ) {
        const activeMainCategories = result.data.mainCategories.filter(
          (mainCat: IMainCategory) => mainCat.isActive,
        );
        setMainCategories(activeMainCategories);
        console.log('✅ Main categories fetched:', activeMainCategories.length);
      } else {
        console.warn('❌ Unexpected main categories response format:', result);
        setMainCategories([]);
      }

      mainCategoriesFetchedRef.current = true;
    } catch (error) {
      console.error('❌ Error fetching main categories:', error);
      setMainCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMainCategory = (mainCategory: IMainCategory) => {
    const next = new Set(selectedMainCategoryIdSet);
    if (next.has(mainCategory.mainCategoryId)) {
      next.delete(mainCategory.mainCategoryId);
    } else {
      next.add(mainCategory.mainCategoryId);
    }

    const nextIds = Array.from(next);
    setSelectedMainCategoryIdSet(next);
    onSelectionChange?.(nextIds);
    console.log('📂 Toggled main category:', mainCategory.mainCategoryName);
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={onBack}
            activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Main Categories</Text>
        </View>
        <View style={[styles.loadingContainer, { paddingHorizontal: 20 }]}>
          <GlamLoader
            title="Loading Service Categories..."
            subtitle="Fetching all available salon & home service options"
            size="large"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={onBack}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Main Categories</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>Select Main Categories</Text>
        <Text style={styles.sectionDescription}>
          Choose all categories you provide services in.
        </Text>

        {mainCategories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="category" size={64} color="#E0E0E0" />
            <Text style={styles.emptyText}>No categories available</Text>
          </View>
        ) : (
          <View style={styles.categoriesGrid}>
            {mainCategories.map(mainCat => {
              const isSelected = selectedMainCategoryIdSet.has(mainCat.mainCategoryId);

              return (
                <TouchableOpacity
                  key={mainCat.mainCategoryId}
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected,
                  ]}
                  onPress={() => handleSelectMainCategory(mainCat)}
                  activeOpacity={0.75}>
                  {mainCat.mainCategoryImage ? (
                    <Image
                      source={{ uri: mainCat.mainCategoryImage }}
                      style={styles.categoryImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.categoryIconWrap}>
                      <Icon name="category" size={28} color="#FD8B36" />
                    </View>
                  )}
                  <Text style={styles.categoryName}>
                    {mainCat.mainCategoryName}
                  </Text>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Icon name="check" size={16} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>

      <View style={styles.nextButtonContainer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            (selectedMainCategoryIdSet.size === 0 || submitting || skipping) && styles.nextButtonDisabled,
          ]}
          onPress={async () => {
            if (submitting || skipping) return;
            if (selectedMainCategoryIdSet.size === 0) {
              try {
                setSkipping(true);
                await onSkip?.();
              } finally {
                setSkipping(false);
              }
            } else {
              try {
                setSubmitting(true);
                await onNext?.(Array.from(selectedMainCategoryIdSet));
              } finally {
                setSubmitting(false);
              }
            }
          }}
          disabled={submitting || skipping}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <LinearGradient
            colors={
              selectedMainCategoryIdSet.size > 0
                ? ['#FD8B36', '#f7bb2c']
                : ['#E0E0E0', '#CCCCCC']
            }
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.nextButtonGradient}>
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.nextButtonText}>Saving & Next...</Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.nextButtonText,
                  selectedMainCategoryIdSet.size === 0 && styles.nextButtonTextDisabled,
                ]}>
                {selectedMainCategoryIdSet.size > 0
                  ? `Next (${selectedMainCategoryIdSet.size} selected)`
                  : 'Next'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        {onSkip && (
          <TouchableOpacity
            style={[styles.skipButton, (submitting || skipping) && { opacity: 0.6 }]}
            onPress={async () => {
              if (submitting || skipping) return;
              try {
                setSkipping(true);
                await onSkip();
              } finally {
                setSkipping(false);
              }
            }}
            disabled={submitting || skipping}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}>
            {skipping ? (
              <ActivityIndicator size="small" color="#FD8B36" />
            ) : (
              <Text style={styles.skipButtonText}>Skip</Text>
            )}
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(30),
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBackButton: {
    position: 'absolute',
    left: 24,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
    marginTop: 20,
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 132,
    borderWidth: 2,
    borderColor: '#FFE4D6',
    position: 'relative',
  },
  categoryCardSelected: {
    borderColor: '#FD8B36',
    backgroundColor: '#FFF8F3',
  },
  categoryImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
  },
  categoryIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E8',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FD8B36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#FFF3E8',
    zIndex: 10,
    elevation: 6,
  },
  nextButton: {
    borderRadius: 12,
    width: '100%',
    overflow: 'hidden',
  },
  nextButtonGradient: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  nextButtonDisabled: {
    opacity: 0.9,
  },
  nextButtonTextDisabled: {
    color: '#555',
  },
  skipButton: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#FD8B36',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SelectServiceScreen;
