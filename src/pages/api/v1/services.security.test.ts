import type { NextApiRequest, NextApiResponse } from 'next';

import handler from './services';

jest.mock('../../../features/services/repository', () => ({
  listServices: jest.fn(),
}));

const { listServices } = jest.requireMock(
  '../../../features/services/repository',
) as {
  listServices: jest.Mock;
};

const createRes = () => {
  const res = {
    statusCode: 200,
    body: undefined as any,
    setHeader: jest.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as unknown as NextApiResponse;

  return res;
};

describe('public services endpoint security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listServices.mockResolvedValue([
      {
        id: 'svc-1',
        name: 'Haircut',
        description: '',
        durationMin: 30,
        priceCents: 2500,
        currency: 'USD',
        active: true,
        bookable: true,
        displayOrder: 1,
      },
    ]);
  });

  it('ignores includeInactive query on public route', async () => {
    const req = {
      method: 'GET',
      query: { includeInactive: 'true' },
    } as unknown as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(listServices).toHaveBeenCalledWith();
    expect((res as any).statusCode).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
  });
});
