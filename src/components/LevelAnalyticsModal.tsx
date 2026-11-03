import { QueuedModal as Modal } from '../popup/PopupProvider';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from './AppLinearGradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentLevel: number;
  criteriaMetCount: number;
  nextLevelRequirement: number;
  progressPercentage: number;
  isMaxLevel: boolean;
  successScore: number;
  rating: number;
  responseRate: number;
  serviceCount: number;
  uniqueClients: number;
  earnings: number;
}

type MetricKey =
  | 'successScore'
  | 'rating'
  | 'responseRate'
  | 'serviceCount'
  | 'uniqueClients'
  | 'earnings';

interface MetricInfo {
  title: string;
  desc: string;
}

interface MetricTarget {
  label: string;
  value: string;
}

interface MetricConfig {
  title: string;
  keyName: MetricKey;
  value: string;
  targets: MetricTarget[];
}

interface MetricBlockProps {
  title: string;
  value: string;
  targets: MetricTarget[];
  keyName: MetricKey;
  activeTooltip: MetricKey | null;
  onToggleTooltip: (key: MetricKey) => void;
}

const LEVEL_LABELS: Record<number, string> = {
  0: 'New',
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
};

const LEVEL_STEPS = ['New', 'Level 1', 'Level 2', 'Level 3'];

const LEVEL_ICONS: Record<number, string> = {
  0: 'auto-awesome',
  1: 'military-tech',
  2: 'verified',
  3: 'workspace-premium',
};

const metricInfo: Record<MetricKey, MetricInfo> = {
  successScore: {
    title: 'Success Score',
    desc: 'This is your overall performance grade. It combines all metrics to show how well you are performing.',
  },
  rating: {
    title: 'Rating',
    desc: 'This metric reflects the average of ratings provided by clients you have worked with.',
  },
  responseRate: {
    title: 'Response Rate',
    desc: 'Measures how quickly you respond to clients within 24 hours.',
  },
  serviceCount: {
    title: 'Service Count',
    desc: 'Total number of successful services completed.',
  },
  uniqueClients: {
    title: 'Unique Clients',
    desc: 'Number of different clients you have served.',
  },
  earnings: {
    title: 'Earnings',
    desc: 'Total earnings generated from your services.',
  },
};

const MetricBlock: React.FC<MetricBlockProps> = ({
  title,
  value,
  targets,
  keyName,
  activeTooltip,
  onToggleTooltip,
}) => {
  const isActive = activeTooltip === keyName;

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.rowTop}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.tooltipAnchor}>
            <TouchableOpacity
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onToggleTooltip(keyName)}
            >
              <Text style={styles.info}>ⓘ</Text>
            </TouchableOpacity>

            {isActive && (
              <View style={styles.inlineTooltip}>
                <Text style={styles.tooltipTitle}>{metricInfo[keyName].title}</Text>
                <Text style={styles.tooltipDesc}>{metricInfo[keyName].desc}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.value}>{value}</Text>
      </View>

      {targets.map(target => (
        <View key={`${keyName}-${target.label}`} style={styles.rowBetween}>
          <Text style={styles.targetLabel}>{target.label}</Text>
          <Text style={styles.targetValue}>{target.value}</Text>
        </View>
      ))}
    </View>
  );
};

const LevelAnalyticsModal: React.FC<Props> = ({
  visible,
  onClose,
  currentLevel,
  criteriaMetCount,
  nextLevelRequirement,
  progressPercentage,
  isMaxLevel,
  successScore,
  rating,
  responseRate,
  serviceCount,
  uniqueClients,
  earnings,
}) => {
  const insets = useSafeAreaInsets();
  const [activeTooltip, setActiveTooltip] = useState<MetricKey | null>(null);

  useEffect(() => {
    if (!visible) {
      setActiveTooltip(null);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      console.log('📊 Level overview modal props:', {
        currentLevel,
        criteriaMetCount,
        nextLevelRequirement,
        progressPercentage,
        isMaxLevel,
        successScore,
        rating,
        responseRate,
        serviceCount,
        uniqueClients,
        earnings,
      });
    }
  }, [
    currentLevel,
    earnings,
    isMaxLevel,
    nextLevelRequirement,
    criteriaMetCount,
    progressPercentage,
    rating,
    responseRate,
    serviceCount,
    successScore,
    uniqueClients,
    visible,
  ]);

  const currentLevelLabel = LEVEL_LABELS[currentLevel] || 'New';
  const nextLevelLabel = LEVEL_LABELS[currentLevel + 1];
  const displayedCriteriaCount = isMaxLevel
    ? criteriaMetCount
    : Math.min(criteriaMetCount, nextLevelRequirement);

  const metrics: MetricConfig[] = [
    {
      title: 'Success Score',
      value: `${successScore}/10`,
      keyName: 'successScore',
      targets: [
        { label: 'Level 1 target', value: '5' },
        { label: 'Level 2 target', value: '7' },
        { label: 'Level 3 target', value: '9' },
      ],
    },
    {
      title: 'Client Ratings',
      value: `${rating}/5`,
      keyName: 'rating',
      targets: [
        { label: 'Level 1 target', value: '4.3' },
        { label: 'Level 2 target', value: '4.5' },
        { label: 'Level 3 target', value: '4.8' },
      ],
    },
    {
      title: 'Response Rate',
      value: `${responseRate}%`,
      keyName: 'responseRate',
      targets: [
        { label: 'Level 1 target', value: '70%' },
        { label: 'Level 2 target', value: '80%' },
        { label: 'Level 3 target', value: '90%' },
      ],
    },
    {
      title: 'Service Count',
      value: `${serviceCount}`,
      keyName: 'serviceCount',
      targets: [
        { label: 'Level 1 target', value: '15' },
        { label: 'Level 2 target', value: '25' },
        { label: 'Level 3 target', value: '35' },
      ],
    },
    {
      title: 'Unique Clients',
      value: `${uniqueClients}`,
      keyName: 'uniqueClients',
      targets: [
        { label: 'Level 1 target', value: '5' },
        { label: 'Level 2 target', value: '10' },
        { label: 'Level 3 target', value: '15' },
      ],
    },
    {
      title: 'Earnings',
      value: `₹${earnings}`,
      keyName: 'earnings',
      targets: [
        { label: 'Level 1 target', value: '₹40k-60k' },
        { label: 'Level 2 target', value: '₹70k-90k' },
        { label: 'Level 3 target', value: '₹1L-1.5L' },
      ],
    },
  ];

  const handleTooltipToggle = (key: MetricKey) => {
    setActiveTooltip(current => (current === key ? null : key));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.containerOuter}>
          {activeTooltip && (
            <TouchableOpacity
              style={styles.clickOutside}
              activeOpacity={1}
              onPress={() => setActiveTooltip(null)}
            />
          )}

          <View style={styles.container}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              bounces={false}
            >
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose}>
                  <Icon name="arrow-back" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Level overview</Text>
                <View style={styles.headerSpacer} />
              </View>

              <View style={styles.levelSection}>
                <LinearGradient
                  colors={['#FD8B36', '#f7bb2c']}
                  locations={[0, 0.7]}
                  start={{ x: 0.5, y: 0.5 }}
                  end={{ x: 0.5, y: 0 }}
                  style={styles.hexagon}
                >
                  <Icon
                    name={LEVEL_ICONS[currentLevel] || LEVEL_ICONS[0]}
                    size={32}
                    color="#fff"
                  />
                </LinearGradient>

                <Text style={styles.levelText}>{currentLevelLabel}</Text>
                {/* <Text style={styles.pointsText}>Criteria met: {criteriaMetCount}</Text> */}
                <Text style={styles.progressText}>
                  {isMaxLevel
                    ? 'You have reached the highest available level.'
                    : `${displayedCriteriaCount}/${nextLevelRequirement} criteria met for ${nextLevelLabel}`}
                </Text>
              </View>

              <View style={styles.progressContainer}>
                {LEVEL_STEPS.map((item, index) => {
                  const isCompleted = index <= currentLevel;
                  const isCurrent = index === currentLevel && !isMaxLevel;
                  const isFullyCompletedLine = index < currentLevel;
                  const isCurrentProgressLine = index === currentLevel && !isMaxLevel;

                  return (
                    <View key={item} style={styles.progressItem}>
                      <View
                        style={[
                          styles.progressCircle,
                          isCompleted && styles.progressCircleActive,
                          isCurrent && styles.progressCircleCurrent,
                        ]}
                      >
                        <Text
                          style={[
                            styles.progressCircleText,
                            isCompleted && styles.progressCircleTextActive,
                          ]}
                        >
                          {index === 0 ? 'N' : index}
                        </Text>
                      </View>

                      {index !== LEVEL_STEPS.length - 1 && (
                        <View style={styles.progressLine}>
                          <View
                            style={[
                              styles.progressLineFill,
                              isFullyCompletedLine && styles.progressLineFillActive,
                              isCurrentProgressLine && {
                                width: `${Math.max(0, Math.min(progressPercentage, 100))}%`,
                              },
                            ]}
                          />
                        </View>
                      )}

                      <Text
                        style={[
                          styles.progressLabel,
                          isCompleted && styles.progressLabelActive,
                        ]}
                      >
                        {item}
                      </Text>
                    </View>
                  );
                })}
              </View>


              {metrics.map(metric => (
                <MetricBlock
                  key={metric.keyName}
                  title={metric.title}
                  value={metric.value}
                  keyName={metric.keyName}
                  targets={metric.targets}
                  activeTooltip={activeTooltip}
                  onToggleTooltip={handleTooltipToggle}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default LevelAnalyticsModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    justifyContent: 'flex-start',
  },
  containerOuter: {
    position: 'relative',
    flex: 1,
  },
  container: {
    zIndex: 2,
    flex: 1,
    backgroundColor: '#FFF3E8',
    padding: 16,
  },
  scrollView: {
    flexGrow: 0,
  },
  clickOutside: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
  },
  headerSpacer: {
    width: 24,
  },
  levelSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  hexagon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FD8B36',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  hexagonLevel: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  levelText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '600',
  },
  pointsText: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  progressText: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  progressItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  progressCircle: {
    width: 28,
    height: 28,
    backgroundColor: '#ECECEC',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E3E3E3',
    zIndex: 2,
  },
  progressCircleActive: {
    backgroundColor: '#FD8B36',
    borderColor: '#FD8B36',
  },
  progressCircleCurrent: {
    shadowColor: '#FD8B36',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  progressCircleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
  },
  progressCircleTextActive: {
    color: '#fff',
  },
  progressLine: {
    position: 'absolute',
    top: 13,
    right: '-50%',
    width: '100%',
    height: 4,
    backgroundColor: '#E3E3E3',
    borderRadius: 999,
    zIndex: 0,
    overflow: 'hidden',
  },
  progressLineFill: {
    height: '100%',
    width: 0,
    backgroundColor: '#FD8B36',
    borderRadius: 999,
  },
  progressLineFillActive: {
    width: '100%',
    backgroundColor: '#FD8B36',
  },
  progressLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  progressLabelActive: {
    color: '#222',
    fontWeight: '600',
  },
  pointsCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1D7C2',
  },
  pointsCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  pointsCardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#8A6B58',
    maxWidth: 210,
  },
  pointsBadge: {
    minWidth: 58,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FD8B36',
  },
  progressBarTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#F7E7D9',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FD8B36',
    borderRadius: 999,
  },
  pointsCardFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsCardFooter: {
    fontSize: 12,
    color: '#666',
  },
  pointsCardFooterStrong: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FD8B36',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  tooltipAnchor: {
    position: 'relative',
  },
  info: {
    fontSize: 18,
    color: '#999',
  },
  inlineTooltip: {
    position: 'absolute',
    top: 24,
    left: 0,
    width: 220,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    marginVertical: 8,
  },
  targetLabel: {
    fontSize: 14,
    color: '#777',
    marginTop: 6,
  },
  targetValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  tooltipDesc: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
});
