const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/pages/HomeScreen.tsx', 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function runEffect(start, end, overrides = {}) {
  const effects = [];
  const state = {ongoing: null, upcoming: [], time: null};
  let refresh;
  const context = {
    useEffect: effect => effects.push(effect), userId: 'stylist',
    API_BASE_URL_WITH_API: 'https://example.test/api',
    setOngoingBooking: value => { state.ongoing = value; },
    setUpcomingBookings: value => { state.upcoming = value; },
    setTimeLeft: value => { state.time = value; },
    getBookingStartTimestamp: () => 0,
    scheduleUpcomingBookingsNotifications: async () => {},
    subscribeToBookingRefresh: callback => { refresh = callback; return () => {}; },
    console: {warn() {}, error() {}},
    setInterval: () => 1, clearInterval() {},
    ...overrides,
  };
  const code = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  vm.runInNewContext(ts.transpileModule(code, {
    compilerOptions: {target: ts.ScriptTarget.ES2020},
  }).outputText, context);
  const cleanup = effects[0]();
  return {state, cleanup, refresh: () => refresh()};
}
const response = bookings => ({ok: true, json: async () => ({success: true, data: {bookings}})});
const start = '  // Refresh both sections together;';
const end = '  // Initialize notifications when component mounts';
const ongoing = {bookingId: 'running', status: 'ongoing'};
const upcoming = {bookingId: 'accepted', status: 'confirmed'};
test('elapsed countdown stays at zero without hiding an ongoing booking', () => {
  const existing = {...ongoing, date: '2020-01-01', startTime: '09:00', endTime: '10:00'};
  let clears = 0;
  const result = runEffect('  // Calculate and update time left for ongoing booking',
    '  // Reset selected slot when date or filter changes', {
      ongoingBooking: existing, setOngoingBooking: () => { clears++; },
    });
  assert.equal(clears, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(result.state.time)), {hours: 0, minutes: 0, seconds: 0});
  result.cleanup();
});
test('notification and network failures preserve fetched booking cards; successful empty response clears them', async () => {
  let mode = 'success';
  const result = runEffect(start, end, {
    fetch: async url => {
      if (mode === 'failure') throw new Error('offline');
      return response(mode === 'empty' ? [] : [url.includes('status=ongoing') ? ongoing : upcoming]);
    },
    scheduleUpcomingBookingsNotifications: async () => { throw new Error('permission denied'); },
  });
  await flush();
  assert.equal(result.state.ongoing.bookingId, 'running');
  assert.equal(result.state.upcoming[0].bookingId, 'accepted');
  mode = 'failure'; result.refresh(); await flush();
  assert.equal(result.state.ongoing.bookingId, 'running');
  assert.equal(result.state.upcoming[0].bookingId, 'accepted');
  mode = 'empty'; result.refresh(); await flush();
  assert.equal(result.state.ongoing, null);
  assert.equal(result.state.upcoming.length, 0);
  result.cleanup();
});
test('older requests and unmounted requests cannot overwrite the latest cards', async () => {
  const pending = [];
  const result = runEffect(start, end, {fetch: () => new Promise(resolve => pending.push(resolve))});
  result.refresh();
  pending[2](response([ongoing])); pending[3](response([upcoming])); await flush();
  pending[0](response([])); pending[1](response([])); await flush();
  assert.equal(result.state.ongoing.bookingId, 'running');
  assert.equal(result.state.upcoming[0].bookingId, 'accepted');
  result.refresh(); result.cleanup();
  pending[4](response([])); pending[5](response([])); await flush();
  assert.equal(result.state.ongoing.bookingId, 'running');
});
test('background stats refresh keeps content visible and coalesces overlapping requests', async () => {
  let tick;
  let calls = 0;
  let finish;
  const loading = [];
  const earnings = [];
  const result = runEffect("  // Fetch today's stats", '  // Fetch service statistics', {
    setInterval: callback => { tick = callback; return 1; },
    setLoadingTodayStats: value => loading.push(value),
    setTodayEarnings: value => earnings.push(value),
    setTodayAppointments() {}, setCompletedCount() {}, setUpcomingCount() {}, setOngoingCount() {},
    console: {log() {}, error() {}},
    fetch: () => { calls++; return new Promise(resolve => { finish = resolve; }); },
  });
  tick();
  assert.equal(calls, 1);
  finish({ok: true, json: async () => ({success: true, data: {todayEarnings: 500}})});
  await flush();
  assert.deepEqual(loading, [true, false]);
  tick(); tick();
  assert.equal(calls, 2);
  assert.deepEqual(loading, [true, false]);
  finish({ok: false, status: 503, text: async () => 'unavailable'});
  await flush();
  assert.deepEqual(earnings, [500]);
  result.cleanup();
  tick();
  assert.equal(calls, 2);
});
