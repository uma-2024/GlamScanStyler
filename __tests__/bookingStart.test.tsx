import React from 'react';
import { AppState, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { canStartBooking, getBookingStartTimestamp, getBookingDateKey } from '../src/utils/bookingTime';
import { useBookingClock } from '../src/hooks/useBookingClock';

const booking = {
  date: '2026-09-10T00:00:00.000Z',
  startTime: '14:30',
  period: 'PM',
  status: 'confirmed',
};
const start = Date.parse('2026-09-10T09:00:00Z');

it.each([
  '2026-09-09T18:30:00.000Z',
  '2026-09-10T00:00:00+05:30',
  '2026-09-10T00:00:00.000Z',
  '2026-09-10',
  new Date('2026-09-09T18:30:00.000Z'),
])('uses the India booking day for %s before allowing a 2 PM start', date => {
  const afternoonBooking = { ...booking, date, startTime: '14:00' };
  expect(getBookingStartTimestamp(afternoonBooking)).toBe(Date.parse('2026-09-10T14:00:00+05:30'));
  expect(canStartBooking(afternoonBooking, Date.parse('2026-09-10T13:11:00+05:30'))).toBe(false);
  expect(canStartBooking(afternoonBooking, Date.parse('2026-09-10T13:59:59.999+05:30'))).toBe(false);
  expect(canStartBooking(afternoonBooking, Date.parse('2026-09-10T14:00:00+05:30'))).toBe(true);
});

it('resolves the India calendar date across month and year boundaries', () => {
  expect(getBookingDateKey('2026-08-31T18:30:00.000Z')).toBe('2026-09-01');
  expect(getBookingDateKey('2025-12-31T18:30:00.000Z')).toBe('2026-01-01');
  expect(getBookingDateKey('invalid')).toBeNull();
});

it('allows only confirmed bookings at or after their own service start in India time', () => {
  expect(getBookingStartTimestamp(booking)).toBe(start);
  expect(canStartBooking(booking, start - 1)).toBe(false);
  expect(canStartBooking(booking, start)).toBe(true);
  expect(canStartBooking(booking, start + 60000)).toBe(true);
  expect(canStartBooking({ ...booking, startTime: '15:30' }, start)).toBe(false);
  expect(canStartBooking({ ...booking, date: '2026-09-11' }, start)).toBe(false);
  for (const status of ['pending', 'ongoing', 'completed', 'cancelled']) {
    expect(canStartBooking({ ...booking, status }, start)).toBe(false);
  }
  expect(canStartBooking({ ...booking, startTime: 'invalid' }, start)).toBe(false);
});

it.each([
  ['14:30', 'PM', '2026-09-10T09:00:00Z'],
  ['12:00', 'AM', '2026-09-10T06:30:00Z'],
  ['12:00', 'PM', '2026-09-10T06:30:00Z'],
  ['00:00', 'AM', '2026-09-09T18:30:00Z'],
  ['11:00', 'PM', '2026-09-10T05:30:00Z'],
])('uses stored 24-hour time %s even with period %s', (startTime, period, expected) => {
  expect(getBookingStartTimestamp({ ...booking, startTime, period })).toBe(Date.parse(expected));
});

it('keeps a noon booking hidden at 11:47 even when its period field says Am', () => {
  const noonBooking = { ...booking, startTime: '12:00', period: 'Am' };
  expect(canStartBooking(noonBooking, Date.parse('2026-09-10T11:47:00+05:30'))).toBe(false);
  expect(canStartBooking(noonBooking, Date.parse('2026-09-10T11:59:59.999+05:30'))).toBe(false);
  expect(canStartBooking(noonBooking, Date.parse('2026-09-10T12:00:00+05:30'))).toBe(true);
});

it('reveals each button at its start time and refreshes immediately after resuming', () => {
  jest.useFakeTimers();
  jest.setSystemTime(start - 15000);
  let onAppStateChange: (state: string) => void = () => {};
  const remove = jest.fn();
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    onAppStateChange = callback;
    return { remove };
  });
  let screen: renderer.ReactTestRenderer | undefined;
  const Bookings = () => {
    const now = useBookingClock();
    return <>
      {canStartBooking(booking, now) && <Text>Start first</Text>}
      {canStartBooking({ ...booking, startTime: '15:30' }, now) && <Text>Start second</Text>}
    </>;
  };
  try {
    act(() => { screen = renderer.create(<Bookings />); });
    expect(screen!.root.findAllByType(Text)).toHaveLength(0);
    act(() => { jest.advanceTimersByTime(14999); });
    expect(screen!.root.findAllByType(Text)).toHaveLength(0);
    act(() => { jest.advanceTimersByTime(1); });
    expect(screen!.root.findAllByType(Text).map(node => node.props.children)).toEqual(['Start first']);
    act(() => {
      jest.setSystemTime(start + 3600000);
      onAppStateChange('active');
    });
    expect(screen!.root.findAllByType(Text)).toHaveLength(2);
  } finally {
    act(() => { screen?.unmount(); });
    expect(remove).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    listener.mockRestore();
    jest.useRealTimers();
  }
});
