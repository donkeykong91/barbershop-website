import type { NextApiRequest } from 'next';

import { getBookingAccessToken } from './bookingAccessToken';

describe('getBookingAccessToken', () => {
  it('reads x-booking-access-token header when present', () => {
    const req = {
      headers: {
        'x-booking-access-token': '  header-token  ',
      },
      query: {},
    } as NextApiRequest;

    expect(getBookingAccessToken(req)).toBe('header-token');
  });

  it('reads bearer token when header token is missing', () => {
    const req = {
      headers: {
        authorization: 'Bearer   bearer-token  ',
      },
      query: {},
    } as NextApiRequest;

    expect(getBookingAccessToken(req)).toBe('bearer-token');
  });

  it('reads accessToken query param when header sources are missing', () => {
    const req = {
      headers: {},
      query: {
        accessToken: '   query-token   ',
      },
    } as NextApiRequest;

    expect(getBookingAccessToken(req)).toBe('query-token');
  });

  it('falls back to first query token when repeated', () => {
    const req = {
      headers: {},
      query: {
        accessToken: ['first-token', 'second-token'],
      },
    } as NextApiRequest;

    expect(getBookingAccessToken(req)).toBe('first-token');
  });

  it('returns empty string when no token is supplied', () => {
    const req = {
      headers: {},
      query: {},
    } as NextApiRequest;

    expect(getBookingAccessToken(req)).toBe('');
  });
});
