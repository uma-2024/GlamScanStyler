import { API_BASE_URL_WITH_API } from '../config/api';
import { getLoginSession } from '../utils/authStorage';

export type EarningsPeriod = 'today' | 'lastWeek' | 'lastMonth' | 'last6Months' | 'lastYear' | 'allTime';

export interface StylistAccountProfile {
  _id?: string;
  userId?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  specialization?: string;
  selectedServices?: Array<{ serviceName?: string; name?: string } | string>;
  profileImage?: string;
  age?: number;
  gender?: string;
  about?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
}

export interface StylistEarnings {
  unreconciledServices: number;
  toBePaidOut: number;
  alreadyPaidByUser: number;
  paidOut: number;
  heldForReview: number;
  totalEarnings: number;
  totalServices: number;
  monthEarning: number;
}

export interface StylistLevel {
  level: number;
  completedServicesWith5Star: number;
  totalCompletedServices: number;
  totalUniqueClients: number;
  totalEarnings: number;
  successScore: number;
  clientRating: number;
  responseRate: number;
  nextTargetLevel: number | null;
  nextLevelRequirement: number;
  progressToNextLevel: number;
  progressPercentage: number;
  criteriaMetCount: number;
  totalCriteriaCount: number;
  isMaxLevel: boolean;
}

export interface CurrentSubscription {
  planName?: string;
  badgeImage?: string;
}

export const accountQueryKeys = {
  profile: (userId?: string) => ['stylist-account', 'profile', userId] as const,
  earnings: (userId?: string, period?: EarningsPeriod) =>
    ['stylist-account', 'earnings', userId, period] as const,
  level: (userId?: string) => ['stylist-account', 'level', userId] as const,
  specialServices: (userId?: string) => ['stylist-account', 'special-services', userId] as const,
  subscription: (userId?: string) => ['stylist-account', 'subscription', userId] as const,
};

const getJson = async <T>(url: string): Promise<T> => {
  const session = await getLoginSession();
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(session?.loginId ? { Authorization: `Bearer ${session.loginId}` } : {}),
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const message = result?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return result;
};

export const fetchStylistProfile = async (userId: string): Promise<StylistAccountProfile | null> => {
  const result = await getJson<{ success?: boolean; data?: StylistAccountProfile }>(
    `${API_BASE_URL_WITH_API}/profile/${userId}`,
  );

  return result?.success && result.data ? result.data : null;
};

export const fetchStylistEarnings = async (
  userId: string,
  period: EarningsPeriod,
): Promise<StylistEarnings> => {
  const result = await getJson<{ success?: boolean; data?: Partial<StylistEarnings> }>(
    `${API_BASE_URL_WITH_API}/stylist/earnings/${userId}?filter=${period}`,
  );

  return {
    totalEarnings: result?.data?.totalEarnings || 0,
    toBePaidOut: result?.data?.toBePaidOut || 0,
    unreconciledServices: result?.data?.unreconciledServices || 0,
    alreadyPaidByUser: result?.data?.alreadyPaidByUser || 0,
    paidOut: result?.data?.paidOut || 0,
    heldForReview: result?.data?.heldForReview || 0,
    totalServices: result?.data?.totalServices || 0,
    monthEarning: result?.data?.monthEarning || 0,
  };
};

export const fetchStylistLevel = async (userId: string): Promise<StylistLevel> => {
  const result = await getJson<{ success?: boolean; data?: Partial<StylistLevel> }>(
    `${API_BASE_URL_WITH_API}/stylist/level/${userId}`,
  );
  const data = result?.data || {};

  return {
    level: data.level ?? 0,
    completedServicesWith5Star: data.completedServicesWith5Star || 0,
    totalCompletedServices: data.totalCompletedServices || 0,
    totalUniqueClients: data.totalUniqueClients || 0,
    totalEarnings: data.totalEarnings || 0,
    successScore: data.successScore || 0,
    clientRating: data.clientRating || 0,
    responseRate: data.responseRate || 0,
    nextTargetLevel: data.nextTargetLevel ?? 1,
    nextLevelRequirement: data.nextLevelRequirement || 6,
    progressToNextLevel: data.progressToNextLevel || 0,
    progressPercentage: data.progressPercentage || 0,
    criteriaMetCount: data.criteriaMetCount || 0,
    totalCriteriaCount: data.totalCriteriaCount || 6,
    isMaxLevel: data.isMaxLevel || false,
  };
};

export const fetchStylistSpecialServices = async (userId: string): Promise<string[]> => {
  const result = await getJson<{ success?: boolean; data?: Array<{ serviceName?: string }> }>(
    `${API_BASE_URL_WITH_API}/services/special/${userId}`,
  );
  const list = Array.isArray(result?.data) ? result.data : [];

  return list.map(item => item?.serviceName).filter((name): name is string => Boolean(name));
};

export const fetchCurrentSubscription = async (
  userId: string,
): Promise<CurrentSubscription | null> => {
  const result = await getJson<{ success?: boolean; data?: CurrentSubscription | null }>(
    `${API_BASE_URL_WITH_API}/subscriptions/current/${userId}`,
  );

  return result?.data || null;
};

export const fetchStylistPayouts = async (stylistId: string, limit: number = 50, page: number = 1) => {
  const session = await getLoginSession();
  const token = session?.loginId;
  
  if (!token) {
    throw new Error('Authentication token not found');
  }

  const response = await fetch(`${API_BASE_URL_WITH_API}/payouts/stylist/${stylistId}?limit=${limit}&page=${page}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Failed to fetch payouts');
  }
  
  return result;
};
