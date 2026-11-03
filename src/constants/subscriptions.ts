/**
 * subscriptions.ts
 *
 * Single source of truth for Google Play subscription product IDs.
 * These must exactly match the Product IDs configured in Google Play Console.
 * Product IDs CANNOT be changed after creation in Play Console.
 *
 * Architecture:
 *   Backend  → plan names, benefits, badge images, internal membership logic
 *   Google Play → official localized price, billing period, payment
 *   Backend  → verifies purchase token and activates membership
 */

import { Platform } from 'react-native';

// ─── Android Product IDs ────────────────────────────────────────────────────
// Must match Play Console exactly (Settings → Monetise → Products → Subscriptions)
export const ANDROID_SUBSCRIPTION_IDS = {
  VERIFIED_PRO: 'verified_pro_partner',
  ELITE_PARTNER: 'elite_partner',
} as const;

export type AndroidSubscriptionId =
  (typeof ANDROID_SUBSCRIPTION_IDS)[keyof typeof ANDROID_SUBSCRIPTION_IDS];

/** Array of all subscription SKUs used when fetching from Google Play. */
export const ANDROID_SUBSCRIPTION_SKUS: string[] = [
  ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  ANDROID_SUBSCRIPTION_IDS.ELITE_PARTNER,
];

// ─── iOS App Store Product IDs ──────────────────────────────────────────────
// Must match App Store Connect exactly (Subscriptions / Non-Renewing Subscriptions)
export const IOS_SUBSCRIPTION_IDS = {
  VERIFIED_PRO: 'verified_pro_partner_monthly',
  ELITE_PARTNER: 'elite_partner_package',
} as const;

export type IosSubscriptionId =
  (typeof IOS_SUBSCRIPTION_IDS)[keyof typeof IOS_SUBSCRIPTION_IDS];

/** Array of all subscription SKUs used when fetching from App Store. */
export const IOS_SUBSCRIPTION_SKUS: string[] = [
  IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  'verified_pro_partner_monthly',
  'verified_pro',
  IOS_SUBSCRIPTION_IDS.ELITE_PARTNER,
  'elite_partner',
];

// ─── Plan Code → Product ID Mappings ───────────────────────────────────────
// Normalised plan codes (from backend planCode field) mapped to Play & App Store SKUs.
export const PLAN_CODE_TO_ANDROID_SKU: Record<string, string> = {
  VERIFIED_PRO: ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIED_PRO_PARTNER: ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIED_PRO_PARTNER_MONTHLY: ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIED_PRO_MONTHLY: ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  PRO: ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  PRO_PARTNER: ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIED: ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIED_PARTNER: ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIEDPRO: ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIEDPROPARTNER: ANDROID_SUBSCRIPTION_IDS.VERIFIED_PRO,
  ELITE: ANDROID_SUBSCRIPTION_IDS.ELITE_PARTNER,
  ELITE_PARTNER: ANDROID_SUBSCRIPTION_IDS.ELITE_PARTNER,
  ELITE_PARTNER_PACKAGE: ANDROID_SUBSCRIPTION_IDS.ELITE_PARTNER,
  ELITE_PACKAGE: ANDROID_SUBSCRIPTION_IDS.ELITE_PARTNER,
};

export const PLAN_CODE_TO_IOS_SKU: Record<string, string> = {
  VERIFIED_PRO: IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIED_PRO_PARTNER: IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIED_PRO_PARTNER_MONTHLY: IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIED_PRO_MONTHLY: IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  PRO: IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  PRO_PARTNER: IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIED: IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIED_PARTNER: IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIEDPRO: IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  VERIFIEDPROPARTNER: IOS_SUBSCRIPTION_IDS.VERIFIED_PRO,
  ELITE: IOS_SUBSCRIPTION_IDS.ELITE_PARTNER,
  ELITE_PARTNER: IOS_SUBSCRIPTION_IDS.ELITE_PARTNER,
  ELITE_PARTNER_PACKAGE: IOS_SUBSCRIPTION_IDS.ELITE_PARTNER,
  ELITE_PACKAGE: IOS_SUBSCRIPTION_IDS.ELITE_PARTNER,
};

/** Get store SKUs depending on platform (iOS or Android). */
export const getSubscriptionSkus = (): string[] => {
  return Platform.OS === 'ios' ? IOS_SUBSCRIPTION_SKUS : ANDROID_SUBSCRIPTION_SKUS;
};

/** Get store product ID for a given planCode depending on platform. */
export const getStoreProductId = (planCode: string): string | null => {
  const normalized = planCode?.trim().toUpperCase() ?? '';
  const map = Platform.OS === 'ios' ? PLAN_CODE_TO_IOS_SKU : PLAN_CODE_TO_ANDROID_SKU;

  if (map[normalized]) {
    return map[normalized];
  }

  // Robust fuzzy keyword fallback matching for plan codes
  if (normalized.includes('ELITE')) {
    return map['ELITE'];
  }
  if (normalized.includes('VERIFIED') || normalized.includes('PRO') || normalized.includes('PLUS')) {
    return map['VERIFIED_PRO'];
  }

  return null;
};

// ─── Plans that must NOT go through Store Purchases ──────────────────────
// Freemium is assigned by the backend automatically — no purchase required.
export const NON_PURCHASABLE_PLAN_CODES = new Set(['FREEMIUM', 'FREE', 'BASIC']);

// ─── Base Plan ID ─────────────────────────────────────────────────────────
// Base plan configured in Play Console for all subscriptions.
export const ANDROID_BASE_PLAN_ID = 'monthly';

// ─── One-Time Product IDs (Ad Campaigns/Boosts - Android & iOS) ───────────
export const ANDROID_AD_IDS = {
  PREMIUM_1D: 'promo_premium_1d',
  MAX_3D: 'promo_max_3d',
  ULTIMATE_7D: 'promo_ultimate_7d',
} as const;

export const ANDROID_AD_SKUS: string[] = [
  ANDROID_AD_IDS.PREMIUM_1D,
  ANDROID_AD_IDS.MAX_3D,
  ANDROID_AD_IDS.ULTIMATE_7D,
];

// iOS App Store Consumable Product IDs
export const IOS_AD_IDS = {
  PREMIUM_1D: 'promo_premium_1d',
  MAX_3D: 'promo_max_3d',
  ULTIMATE_7D: 'promo_ultimate_7d',
} as const;

export const IOS_AD_SKUS: string[] = [
  IOS_AD_IDS.PREMIUM_1D,
  IOS_AD_IDS.MAX_3D,
  IOS_AD_IDS.ULTIMATE_7D,
];

// Mapping frontend internal ad plan IDs (premium, max, ultimate) to Store SKUs
export const AD_PLAN_ID_TO_ANDROID_SKU: Record<string, string> = {
  premium: ANDROID_AD_IDS.PREMIUM_1D,
  max: ANDROID_AD_IDS.MAX_3D,
  ultimate: ANDROID_AD_IDS.ULTIMATE_7D,
};

export const AD_PLAN_ID_TO_IOS_SKU: Record<string, string> = {
  premium: IOS_AD_IDS.PREMIUM_1D,
  max: IOS_AD_IDS.MAX_3D,
  ultimate: IOS_AD_IDS.ULTIMATE_7D,
};

export const getAdSkus = (): string[] => {
  return Platform.OS === 'ios' ? IOS_AD_SKUS : ANDROID_AD_SKUS;
};

export const getAdStoreProductId = (planId: string): string => {
  const normalized = planId?.trim().toLowerCase() ?? '';
  if (Platform.OS === 'ios') {
    return AD_PLAN_ID_TO_IOS_SKU[normalized] ?? IOS_AD_IDS.PREMIUM_1D;
  }
  return AD_PLAN_ID_TO_ANDROID_SKU[normalized] ?? ANDROID_AD_IDS.PREMIUM_1D;
};
