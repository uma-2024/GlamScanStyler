import React from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import {
  endConnection,
  finishTransaction,
  fetchProducts,
  getAvailablePurchases,
  getReceiptDataIOS,
  getReceiptIOS,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  syncIOS,
} from 'react-native-iap';
import CustomModal from '../src/components/CustomModal';
import SubscriptionScreen from '../src/pages/SubscriptionScreen';
import { authenticatedFetch } from '../src/services/apiClient';
import { getLoginSession } from '../src/utils/authStorage';

jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(),
  endConnection: jest.fn(),
  fetchProducts: jest.fn(),
  requestPurchase: jest.fn(),
  finishTransaction: jest.fn(),
  getAvailablePurchases: jest.fn(),
  getReceiptDataIOS: jest.fn(),
  getReceiptIOS: jest.fn(),
  syncIOS: jest.fn(),
  purchaseUpdatedListener: jest.fn(),
  purchaseErrorListener: jest.fn(),
}));
jest.mock('../src/config/api', () => ({
  API_BASE_URL_WITH_API: 'https://api.example.test/api',
}));
jest.mock('../src/services/apiClient', () => ({
  authenticatedFetch: jest.fn(),
}));
jest.mock('../src/utils/authStorage', () => ({ getLoginSession: jest.fn() }));
jest.mock('../src/components/CustomModal', () => 'CustomModal');
jest.mock('../src/components/SafeAreaView', () => require('react-native').View);
jest.mock('../src/components/AppLinearGradient', () => require('react-native').View);

const receipt = 'store-receipt-'.repeat(15);
const membershipPurchase = (productId = 'verified_pro_partner_monthly') => ({
  productId,
  transactionId: `transaction-${productId}`,
  purchaseToken: receipt,
});

describe('SubscriptionScreen restore purchases', () => {
  const originalPlatform = Platform.OS;
  const originalFetch = global.fetch;
  let screen: renderer.ReactTestRenderer | undefined;
  let events: string[];
  let plans: Record<string, unknown>[];
  let currentMembership: { planCode: string; planName: string };
  let verificationFails: boolean;
  let onSubscriptionActivated: jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Platform.OS = 'ios';
    events = [];
    plans = [];
    currentMembership = { planCode: 'FREE', planName: 'Free Plan' };
    verificationFails = false;
    onSubscriptionActivated = jest.fn();

    jest.mocked(initConnection).mockResolvedValue(true);
    jest.mocked(endConnection).mockResolvedValue(undefined);
    jest.mocked(fetchProducts).mockResolvedValue([]);
    jest.mocked(getReceiptDataIOS).mockResolvedValue(receipt);
    jest.mocked(purchaseUpdatedListener).mockReturnValue({ remove: jest.fn() });
    jest.mocked(purchaseErrorListener).mockReturnValue({ remove: jest.fn() });
    jest.mocked(getLoginSession).mockResolvedValue({
      loginId: 'login-token',
      userId: 'stylist-123',
    } as Awaited<ReturnType<typeof getLoginSession>>);
    jest.mocked(syncIOS).mockImplementation(async () => {
      events.push('sync');
      return true;
    });
    jest.mocked(getAvailablePurchases).mockImplementation(async () => {
      events.push('query');
      return [membershipPurchase()] as Awaited<ReturnType<typeof getAvailablePurchases>>;
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: plans }),
    })) as unknown as typeof fetch;
    jest.mocked(authenticatedFetch).mockImplementation(async (url, options) => {
      if (String(url).includes('/google-play/verify')) {
        const body = JSON.parse(String(options?.body));
        events.push(`verify:${body.productId}`);
        if (!verificationFails) {
          currentMembership = { planCode: 'VERIFIED_PRO_PARTNER', planName: 'Verified Pro Partner' };
        }
        return {
          ok: !verificationFails,
          status: verificationFails ? 400 : 200,
          text: async () => JSON.stringify({
            success: !verificationFails,
            message: verificationFails ? 'Purchase could not be verified.' : undefined,
          }),
        } as Response;
      }
      events.push('membership');
      return { ok: true, json: async () => ({ data: currentMembership }) } as Response;
    });
  });

  afterEach(async () => {
    if (screen) {
      await act(async () => screen?.unmount());
      screen = undefined;
    }
    Platform.OS = originalPlatform;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const mount = async () => {
    await act(async () => {
      screen = renderer.create(
        <SubscriptionScreen
          stylistId="stylist-123"
          onSubscriptionActivated={onSubscriptionActivated}
        />,
      );
    });
  };

  const restoreButton = () => {
    const button = screen?.root.findAllByType(TouchableOpacity).find(node =>
      node.findAllByType(Text).some(textNode => textNode.props.children === 'Restore Purchases'),
    );
    expect(button).toBeDefined();
    return button!;
  };

  const restore = async () => {
    const button = restoreButton();
    await act(async () => { await button.props.onPress(); });
  };

  const modal = () => screen!.root.findByType(CustomModal).props;
  const verificationRequests = () => jest.mocked(authenticatedFetch).mock.calls.filter(
    ([url]) => String(url).includes('/google-play/verify'),
  );

  it('shows an iOS restore button without synchronizing or querying purchases on mount', async () => {
    await mount();

    expect(restoreButton().props.disabled).toBeFalsy();
    expect(syncIOS).not.toHaveBeenCalled();
    expect(getAvailablePurchases).not.toHaveBeenCalled();
    expect(verificationRequests()).toHaveLength(0);
  });

  it('synchronizes iOS on tap, verifies purchases, then refreshes the displayed membership', async () => {
    await mount();
    events.length = 0;

    await restore();

    expect(events).toEqual(['sync', 'query', 'verify:verified_pro_partner_monthly', 'membership']);
    expect(getAvailablePurchases).toHaveBeenCalledWith({
      alsoPublishToEventListenerIOS: false,
      onlyIncludeActiveItemsIOS: false,
    });
    expect(finishTransaction).toHaveBeenCalledWith({ purchase: membershipPurchase(), isConsumable: false });
    expect(onSubscriptionActivated).toHaveBeenCalledTimes(1);
    expect(screen!.root.findAllByType(Text).some(
      node => node.props.children === 'Verified Pro Partner',
    )).toBe(true);
    expect(modal()).toMatchObject({ visible: true, type: 'success', title: 'Restored' });
    const payload = JSON.parse(String(verificationRequests()[0][1]?.body));
    expect(payload).toMatchObject({
      productId: 'verified_pro_partner_monthly',
      platform: 'ios',
      purchaseToken: receipt,
      transactionId: 'transaction-verified_pro_partner_monthly',
    });
  });

  it('keeps restore available after a failed initial connection and reconnects when tapped', async () => {
    jest.mocked(initConnection).mockResolvedValueOnce(false).mockImplementationOnce(async () => {
      events.push('connect');
      return true;
    });
    await mount();
    events.length = 0;

    await restore();

    expect(initConnection).toHaveBeenCalledTimes(2);
    expect(events.slice(0, 3)).toEqual(['connect', 'sync', 'query']);
    expect(modal().type).toBe('success');
  });

  it('reports restore failure when reconnecting is unsuccessful', async () => {
    jest.mocked(initConnection).mockResolvedValue(false);
    await mount();

    await restore();

    expect(initConnection).toHaveBeenCalledTimes(2);
    expect(syncIOS).not.toHaveBeenCalled();
    expect(getAvailablePurchases).not.toHaveBeenCalled();
    expect(modal()).toMatchObject({ visible: true, type: 'error' });
    expect(onSubscriptionActivated).not.toHaveBeenCalled();
  });

  it('restores configured membership IDs while excluding unrelated consumable purchases', async () => {
    plans = [{
      _id: 'plan-configured',
      planCode: 'CUSTOM_MEMBERSHIP',
      planName: 'Custom Membership',
      price: 100,
      durationLabel: 'month',
      iosProductId: 'custom_membership_monthly',
    }];
    jest.mocked(getAvailablePurchases).mockResolvedValue([
      membershipPurchase('promo_premium_1d'),
      membershipPurchase('custom_membership_monthly'),
    ] as Awaited<ReturnType<typeof getAvailablePurchases>>);
    await mount();

    await restore();

    expect(verificationRequests()).toHaveLength(1);
    const payload = JSON.parse(String(verificationRequests()[0][1]?.body));
    expect(payload.productId).toBe('custom_membership_monthly');
    expect(modal().type).toBe('success');
  });

  it('shows no purchases when there are no restorable memberships', async () => {
    jest.mocked(getAvailablePurchases).mockResolvedValue([]);
    await mount();

    await restore();

    expect(verificationRequests()).toHaveLength(0);
    expect(onSubscriptionActivated).not.toHaveBeenCalled();
    expect(modal()).toMatchObject({ visible: true, type: 'info', title: 'No purchases found' });
  });

  it('reports verification failure without claiming the purchase was absent or restored', async () => {
    verificationFails = true;
    await mount();
    events.length = 0;

    await restore();

    expect(verificationRequests()).toHaveLength(1);
    expect(events).not.toContain('membership');
    expect(finishTransaction).not.toHaveBeenCalled();
    expect(onSubscriptionActivated).not.toHaveBeenCalled();
    expect(modal()).toMatchObject({ visible: true, type: 'error', title: 'Restore failed' });
  });

  it('reports sync errors and allows a subsequent restore attempt', async () => {
    jest.mocked(syncIOS).mockRejectedValueOnce(new Error('Store unavailable'));
    await mount();

    await restore();

    expect(getAvailablePurchases).not.toHaveBeenCalled();
    expect(modal()).toMatchObject({ visible: true, type: 'error', title: 'Restore failed' });
    expect(restoreButton().props.disabled).toBeFalsy();

    await restore();

    expect(syncIOS).toHaveBeenCalledTimes(2);
    expect(modal().type).toBe('success');
  });

  it('reads receipts without forcing a refresh for multiple restored purchases', async () => {
    jest.mocked(getAvailablePurchases).mockResolvedValue([
      membershipPurchase(), membershipPurchase('elite_partner_package'),
    ] as Awaited<ReturnType<typeof getAvailablePurchases>>);
    await mount();
    await restore();
    expect(syncIOS).toHaveBeenCalledTimes(1);
    expect(getReceiptDataIOS).toHaveBeenCalledTimes(2);
    expect(getReceiptIOS).not.toHaveBeenCalled();
    expect(finishTransaction).toHaveBeenCalledTimes(2);
    expect(modal().type).toBe('success');
  });

  it('does not retry or refresh when the local receipt is unavailable', async () => {
    jest.mocked(getReceiptDataIOS).mockRejectedValue(new Error('No local receipt'));
    await mount();
    await restore();
    expect(getReceiptDataIOS).toHaveBeenCalledTimes(1);
    expect(getReceiptIOS).not.toHaveBeenCalled();
    expect(verificationRequests()).toHaveLength(1);
  });

  it('shows synchronization failures in the restore popup', async () => {
    jest.mocked(syncIOS).mockRejectedValueOnce(new Error('Authentication cancelled'));
    await mount();
    await restore();
    expect(modal().message).toContain('Synchronizing with App Store: Authentication cancelled');
    expect(verificationRequests()).toHaveLength(0);
  });

  it('reports purchase lookup failures instead of claiming no purchases exist', async () => {
    jest.mocked(getAvailablePurchases).mockRejectedValueOnce(new Error('Store unavailable'));
    await mount();
    await restore();
    expect(modal().title).toBe('Restore failed');
    expect(modal().message).toContain('Reading purchases from App Store: Store unavailable');
  });

  it('distinguishes transaction finishing failures from verification failures', async () => {
    jest.mocked(finishTransaction).mockRejectedValueOnce(new Error('Transaction unavailable'));
    await mount();
    await restore();
    expect(modal().message).toContain('Finishing the restored transaction: Transaction unavailable');
  });

  it('ignores a redelivered transaction after restore has finished it', async () => {
    await mount();
    await restore();
    const listener = jest.mocked(purchaseUpdatedListener).mock.calls[0][0];
    await act(async () => { await listener(membershipPurchase() as any); });
    expect(verificationRequests()).toHaveLength(1);
    expect(finishTransaction).toHaveBeenCalledTimes(1);
  });

  it('ignores duplicate taps while a restore is in progress', async () => {
    let completeSync: (() => void) | undefined;
    jest.mocked(syncIOS).mockImplementation(() => new Promise(resolve => {
      completeSync = () => resolve(true);
    }));
    await mount();
    const button = restoreButton();
    let pendingRestore: Promise<void> | undefined;

    await act(async () => {
      pendingRestore = button.props.onPress();
      await button.props.onPress();
    });
    expect(syncIOS).toHaveBeenCalledTimes(1);
    expect(getAvailablePurchases).not.toHaveBeenCalled();

    await act(async () => {
      completeSync!();
      await pendingRestore;
    });
    expect(getAvailablePurchases).toHaveBeenCalledTimes(1);
    expect(onSubscriptionActivated).toHaveBeenCalledTimes(1);
  });

  it('preserves Android restore without invoking iOS store synchronization', async () => {
    Platform.OS = 'android';
    jest.mocked(getAvailablePurchases).mockResolvedValue([
      membershipPurchase('verified_pro_partner'),
    ] as Awaited<ReturnType<typeof getAvailablePurchases>>);
    await mount();

    await restore();

    expect(syncIOS).not.toHaveBeenCalled();
    expect(getAvailablePurchases).toHaveBeenCalledWith();
    expect(verificationRequests()).toHaveLength(1);
    expect(modal()).toMatchObject({ visible: true, type: 'success', title: 'Restored' });
  });
});
