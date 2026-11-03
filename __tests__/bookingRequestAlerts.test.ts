import AsyncStorage from '@react-native-async-storage/async-storage';
import {alertBookingRequestOnce} from '../src/utils/bookingRequestAlerts';

beforeEach(async () => { await AsyncStorage.clear(); });

test('two different bookings arriving together both alert', async () => {
  const display = jest.fn(async () => true);
  await Promise.all([
    alertBookingRequestOnce('first', display),
    alertBookingRequestOnce('second', display),
  ]);
  expect(display).toHaveBeenCalledTimes(2);
});

test('concurrent push and polling for the same booking alert once', async () => {
  const display = jest.fn(async () => true);
  await Promise.all([
    alertBookingRequestOnce('same', display),
    alertBookingRequestOnce('same', display),
  ]);
  expect(display).toHaveBeenCalledTimes(1);
});

test('a failed display can be retried', async () => {
  const display = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await alertBookingRequestOnce('retry', display);
  await alertBookingRequestOnce('retry', display);
  expect(display).toHaveBeenCalledTimes(2);
});
