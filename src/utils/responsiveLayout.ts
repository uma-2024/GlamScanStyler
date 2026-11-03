import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// Base design reference (iPhone 11 / standard UI)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Screen categories
export const isSmallScreen = width < 360;
export const isMediumScreen = width >= 360 && width < 400;
export const isLargeScreen = width >= 400;

// Height check for compact devices. Tall 360-390px wide phones should keep
// usable top spacing instead of being treated like cramped small screens.
export const isCompactHeightScreen = height <= 740;

export const scale = (size: number): number =>
  (width / guidelineBaseWidth) * size;

export const verticalScale = (size: number): number =>
  (height / guidelineBaseHeight) * size;

export const moderateScale = (size: number, factor = 0.5): number =>
  size + (scale(size) - size) * factor;

export const compactTopPadding = (regularPadding: number): number => {
  const isHeaderSpacing = regularPadding <= 60;
  const isNarrowScreen = width <= 390;
  const largeScreenTopPadding =
    !isNarrowScreen && !isCompactHeightScreen ? regularPadding : 0;

  if (isHeaderSpacing) {
    if (regularPadding <= 0) {
      return 0;
    }

    if (Platform.OS === 'ios') {
      return Math.min(10, Math.max(4, Math.round(regularPadding * 0.2)));
    }

    if (isNarrowScreen) {
      return Math.round(regularPadding * 0.5);
    }

    return largeScreenTopPadding;
  }

  if (isCompactHeightScreen) {
    return Math.max(0, Math.round(regularPadding * 0.25));
  }

  if (isMediumScreen) {
    return Math.round(regularPadding * 0.45) + largeScreenTopPadding;
  }

  return Math.round(regularPadding * 0.45) + largeScreenTopPadding;
};
