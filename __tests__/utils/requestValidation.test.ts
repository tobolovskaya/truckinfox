import {
  checkDuplicateRequest,
  checkRequestRateLimit,
  validateRequestData,
} from '../../utils/requestValidation';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.Mock;

const mockCargoRequestsResponse = (data: unknown[] | null, error: unknown = null) => {
  const gt = jest.fn().mockResolvedValue({ data, error });
  const eq = jest.fn(() => ({ gt }));
  const select = jest.fn(() => ({ eq }));

  mockFrom.mockReturnValue({ select });
};

describe('checkDuplicateRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should detect duplicate requests', async () => {
    mockCargoRequestsResponse([
        {
          user_id: 'user1',
          from_address: 'Oslo',
          to_address: 'Bergen',
        },
      ]);

    const error = await checkDuplicateRequest('user1', 'Oslo', 'Bergen');

    expect(error).toBeTruthy();
  });

  it('should allow different addresses', async () => {
    mockCargoRequestsResponse([
        {
          user_id: 'user1',
          from_address: 'Oslo',
          to_address: 'Bergen',
        },
      ]);

    const error = await checkDuplicateRequest('user1', 'Oslo', 'Trondheim');

    expect(error).toBeNull();
  });
});

describe('checkRequestRateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return error when request limit is reached', async () => {
    mockCargoRequestsResponse([{ id: '1' }, { id: '2' }]);

    const error = await checkRequestRateLimit('user1', 2, 60_000);

    expect(error).toContain('Rate limit exceeded');
  });

  it('should allow request when under limit', async () => {
    mockCargoRequestsResponse([{ id: '1' }]);

    const error = await checkRequestRateLimit('user1', 2, 60_000);

    expect(error).toBeNull();
  });
});

describe('validateRequestData', () => {
  it('should return no errors for valid request data', () => {
    const errors = validateRequestData({
      title: 'Transport of office furniture',
      description: 'Need delivery from city center to warehouse next day.',
      from_address: 'Oslo',
      to_address: 'Bergen',
      cargo_type: 'general',
      weight: 100,
      price: 5000,
    });

    expect(errors).toEqual([]);
  });

  it('should return validation errors for invalid request data', () => {
    const errors = validateRequestData({
      title: 'abc',
      description: 'short',
      from_address: 'Oslo',
      to_address: 'Oslo',
      cargo_type: '',
      weight: -1,
      price: -10,
    });

    expect(errors).toContain('Title must be at least 5 characters');
    expect(errors).toContain('Description must be at least 10 characters');
    expect(errors).toContain('Pickup and delivery locations must be different');
    expect(errors).toContain('Cargo type is required');
    expect(errors).toContain('Weight must be a positive number');
    expect(errors).toContain('Price must be a valid number');
  });
});
