import { listBookings } from './repository';
import { queryAll } from '../../lib/db/sqlite';

jest.mock('../../lib/db/sqlite', () => ({
  queryAll: jest.fn(),
  queryOne: jest.fn(),
  run: jest.fn(),
}));

jest.mock('../services/repository', () => ({
  getServiceById: jest.fn(),
}));

describe('listBookings status filter normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (queryAll as jest.Mock).mockResolvedValue([]);
  });

  it('queries canonical and legacy status variants for confirmed filter', async () => {
    await listBookings({ status: 'confirmed', limit: 10 });

    expect(queryAll).toHaveBeenCalledTimes(1);
    const [sql, args] = (queryAll as jest.Mock).mock.calls[0] as [string, Array<string | number>];

    expect(sql).toContain('b.status IN');
    expect(args).toEqual(expect.arrayContaining(['confirmed', 'CONFIRMED', 'BOOKED']));
  });
});
