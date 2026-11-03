import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import BookingsScreen from '../src/pages/BookingsScreen';

jest.mock('../src/services/stylistRealtime', () => ({ connectStylistRealtimeSocket: () => () => {}, subscribeToSocketBookingUpdates: () => () => {} }));
jest.mock('../src/config/api', () => ({ API_BASE_URL_WITH_API: 'https://example.test/api' }));
jest.mock('../src/components/SafeAreaView', () => require('react-native').View);
jest.mock('../src/components/Shimmer', () => () => null);
jest.mock('../src/components/RatingModal', () => () => null);
jest.mock('../src/components/CustomModal', () => () => null);
jest.mock('../src/pages/UpcomingBookingDetailsScreen', () => () => null);
jest.mock('../src/pages/BookingChatScreen', () => () => null);
jest.mock('../src/utils/notificationService', () => ({ cancelBookingNotification: jest.fn() }));

const booking = {
  bookingId: 'noon-service', userId: 'client', userName: 'User',
  serviceName: 'Classic Lash Lift', date: '2026-09-10',
  startTime: '12:00', endTime: '13:00', period: 'Am',
  status: 'confirmed', price: 1, serviceType: 'Home',
};
const response = (bookings: object[]) => ({
  ok: true, json: async () => ({ success: true, data: { bookings } }),
});

describe('upcoming service card visibility', () => {
  let screen: renderer.ReactTestRenderer;
  const originalFetch = global.fetch;
  let requests: Array<(value: any) => void>;
  const texts = () => screen.root.findAllByType(Text).map(node => node.props.children).flat();
  const pressTab = (label: string) => {
    const tab = screen.root.findAllByType(TouchableOpacity).find(node =>
      node.findAllByType(Text).some(text => text.props.children === label),
    );
    act(() => { tab!.props.onPress(); });
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-09-10T11:47:00+05:30'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    requests = [];
    global.fetch = jest.fn(() => new Promise(resolve => { requests.push(resolve); })) as jest.Mock;
    await act(async () => { screen = renderer.create(<BookingsScreen userId="stylist" />); });
  });

  afterEach(() => {
    act(() => { screen.unmount(); });
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shows service details before noon and adds only its Start Now button at noon', async () => {
    const laterBooking = { ...booking, bookingId: 'later', serviceName: 'Hair Cut', startTime: '14:00' };
    await act(async () => { requests[0](response([booking, laterBooking])); });
    expect(texts()).toContain('Classic Lash Lift');
    expect(texts()).toContain('Hair Cut');
    expect(texts()).toContain('User');
    expect(texts()).toContain('30 Min Before');
    expect(texts()).not.toContain('Start Now');
    act(() => { jest.advanceTimersByTime(13 * 60000); });
    expect(texts()).toContain('Classic Lash Lift');
    expect(texts()).toContain('Hair Cut');
    expect(texts().filter(text => text === 'Start Now')).toHaveLength(1);
  });

  it('does not let a late response from another tab hide upcoming services', async () => {
    await act(async () => { requests[0](response([booking])); });
    pressTab('Ongoing');
    pressTab('Upcoming');
    await act(async () => { requests[2](response([booking])); });
    expect(texts()).toContain('Classic Lash Lift');
    await act(async () => { requests[1](response([])); });
    expect(texts()).toContain('Classic Lash Lift');
    expect(texts()).not.toContain('Start Now');
  });

  it('keeps the 2 PM service visible at 1:11 PM when its date arrives as the previous UTC day', async () => {
    act(() => { jest.setSystemTime(Date.parse('2026-09-10T13:11:00+05:30')); });
    const afternoonBooking = {
      ...booking, date: '2026-09-09T18:30:00.000Z', startTime: '14:00', endTime: '15:00', period: 'Pm',
    };
    await act(async () => { requests[0](response([afternoonBooking])); });
    // Advance to the next clock tick, then verify the rendered card and action.
    act(() => { jest.advanceTimersByTime(60000); });
    expect(texts()).toContain('10 September 2026, 2:00 PM');
    expect(texts()).toContain('Classic Lash Lift');
    expect(texts()).not.toContain('Start Now');
    act(() => { jest.advanceTimersByTime(48 * 60000); });
    expect(texts()).toContain('Classic Lash Lift');
    expect(texts()).toContain('Start Now');
  });

  it('keeps a confirmed service visible when its schedule is invalid and hides its start button', async () => {
    await act(async () => { requests[0](response([{ ...booking, date: 'invalid' }])); });
    expect(texts()).toContain('Classic Lash Lift');
    expect(texts()).not.toContain('Start Now');
  });
});
