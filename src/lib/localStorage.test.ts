import { describe, expect, it } from 'vitest';
import {
  clearSession, deleteTrip, getSession, getUserId, getUserIdForEmail, getUserPreferences,
  getUserTrips, saveSession, saveTrip, updateTripFavorite, upsertUserPreferences,
} from './localStorage';

const baseTrip = {
  ev_model_id: '1',
  origin_address: 'A', origin_lat: 0, origin_lng: 0,
  destination_address: 'B', destination_lat: 1, destination_lng: 1,
  starting_battery_percent: 80,
};

describe('profiles and sessions', () => {
  it('gives each email a stable, distinct profile id', () => {
    expect(getUserIdForEmail('a@b.co')).toBe(getUserIdForEmail('a@b.co'));
    expect(getUserIdForEmail('a@b.co')).not.toBe(getUserIdForEmail('c@d.co'));
    expect(getUserIdForEmail('a@b.co')).toMatch(/^user_[a-z0-9]+$/);
  });

  it('reuses the stored guest id', () => {
    expect(getUserId()).toBe(getUserId());
  });

  it('round-trips and clears a session', () => {
    expect(getSession()).toBeNull();
    saveSession({ id: 'user_x', email: 'x@y.z' });
    expect(getSession()).toEqual({ id: 'user_x', email: 'x@y.z' });
    clearSession();
    expect(getSession()).toBeNull();
  });

  it('ignores a corrupted session', () => {
    localStorage.setItem('neural_navigator_session', '{not json');
    expect(getSession()).toBeNull();
    localStorage.setItem('neural_navigator_session', JSON.stringify({ email: 'no-id' }));
    expect(getSession()).toBeNull();
  });
});

describe('trips', () => {
  it('keeps trips separate per user', () => {
    saveTrip({ ...baseTrip, user_id: 'u1' });
    saveTrip({ ...baseTrip, user_id: 'u2' });
    expect(getUserTrips('u1')).toHaveLength(1);
    expect(getUserTrips('u2')).toHaveLength(1);
    expect(getUserTrips('nobody')).toHaveLength(0);
  });

  it('favorites and deletes only the owner\'s trip', () => {
    const trip = saveTrip({ ...baseTrip, user_id: 'u1' });
    expect(updateTripFavorite(trip.id, 'someone-else', true)).toBeNull();
    expect(updateTripFavorite(trip.id, 'u1', true)?.is_favorite).toBe(true);
    expect(getUserTrips('u1', true)).toHaveLength(1);
    deleteTrip(trip.id, 'someone-else');
    expect(getUserTrips('u1')).toHaveLength(1);
    deleteTrip(trip.id, 'u1');
    expect(getUserTrips('u1')).toHaveLength(0);
  });
});

describe('preferences', () => {
  it('stores preferences per user', () => {
    upsertUserPreferences('u1', { battery_health_percent: 90 });
    expect(getUserPreferences('u1')?.battery_health_percent).toBe(90);
    expect(getUserPreferences('u2')).toBeNull();
  });
});
