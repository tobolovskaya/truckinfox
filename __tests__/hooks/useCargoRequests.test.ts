import { renderHook, waitFor } from '@testing-library/react-native';
import { useCargoRequests } from '../../hooks/useCargoRequests';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));

describe('useCargoRequests', () => {
  const mockSetQueryData = jest.fn();
  const mockRefetch = jest.fn();
  const mockFetchNextPage = jest.fn();

  const defaultQueryResult = {
    data: {
      pages: [
        {
          items: [
            {
              id: '1',
              cargo_type: 'automotive',
              status: 'active',
              created_at: '2025-01-01T12:00:00.000Z',
              pickup_date: '2025-01-03T12:00:00.000Z',
              price: 1000,
            },
          ],
          hasMore: true,
          lastVisible: null,
        },
      ],
    },
    error: null,
    isLoading: false,
    isRefetching: false,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: true,
    isFetchingNextPage: false,
    refetch: mockRefetch,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({
      setQueryData: mockSetQueryData,
    });
    (useInfiniteQuery as jest.Mock).mockReturnValue(defaultQueryResult);
  });

  it('should return flattened requests from paginated data', async () => {
    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: { city: '', cargo_type: '', price_min: '', price_max: '', price_type: '' },
        sortBy: 'newest',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.requests).toHaveLength(1);
    expect(result.current.requests[0].id).toBe('1');
    expect(result.current.hasMore).toBe(true);
  });

  it('should expose loading and error states from query', async () => {
    (useInfiniteQuery as jest.Mock).mockReturnValueOnce({
      ...defaultQueryResult,
      isLoading: true,
      error: new Error('failed to load'),
      hasNextPage: false,
    });

    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: { city: '', cargo_type: '', price_min: '', price_max: '', price_type: '' },
        sortBy: 'newest',
      })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe('failed to load');
    expect(result.current.hasMore).toBe(false);
  });

  it('should call refetch via refresh and fetchRequests', async () => {
    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: { city: '', cargo_type: '', price_min: '', price_max: '', price_type: '' },
        sortBy: 'newest',
      })
    );

    result.current.refresh();
    result.current.fetchRequests();

    expect(mockRefetch).toHaveBeenCalledTimes(2);
  });

  it('should fetch more only when next page is available', async () => {
    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: { city: '', cargo_type: '', price_min: '', price_max: '', price_type: '' },
        sortBy: 'newest',
      })
    );

    await result.current.fetchMoreRequests();
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);

    (useInfiniteQuery as jest.Mock).mockReturnValueOnce({
      ...defaultQueryResult,
      hasNextPage: false,
    });

    const { result: resultNoNext } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: { city: '', cargo_type: '', price_min: '', price_max: '', price_type: '' },
        sortBy: 'newest',
      })
    );

    await resultNoNext.current.fetchMoreRequests();
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('should update cached requests via setRequests', async () => {
    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: { city: '', cargo_type: '', price_min: '', price_max: '', price_type: '' },
        sortBy: 'newest',
      })
    );

    const nextRequests = [
      {
        id: '2',
        cargo_type: 'general',
        status: 'active',
        created_at: '2025-01-02T12:00:00.000Z',
        pickup_date: '2025-01-04T12:00:00.000Z',
        price: 1500,
      },
    ];

    result.current.setRequests(nextRequests as never);

    expect(mockSetQueryData).toHaveBeenCalled();
    expect(mockSetQueryData).toHaveBeenCalledWith(
      [
        'cargoRequests',
        'all',
        { city: '', cargo_type: '', price_min: '', price_max: '', price_type: '' },
        'newest',
        '',
        undefined,
      ],
      expect.any(Function)
    );
  });

  it('should expose loadingMore and refreshing flags', async () => {
    (useInfiniteQuery as jest.Mock).mockReturnValueOnce({
      ...defaultQueryResult,
      isFetchingNextPage: true,
      isRefetching: true,
    });

    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: { city: '', cargo_type: '', price_min: '', price_max: '', price_type: '' },
        sortBy: 'newest',
      })
    );

    expect(result.current.loadingMore).toBe(true);
    expect(result.current.refreshing).toBe(true);
  });

  it('should guard fetchMore while already fetching', async () => {
    (useInfiniteQuery as jest.Mock).mockReturnValueOnce({
      ...defaultQueryResult,
      isFetchingNextPage: true,
    });

    const { result } = renderHook(() =>
      useCargoRequests({
        activeTab: 'all',
        filters: { city: '', cargo_type: '', price_min: '', price_max: '', price_type: '' },
        sortBy: 'newest',
      })
    );

    await result.current.fetchMoreRequests();

    expect(mockFetchNextPage).not.toHaveBeenCalled();
  });

  it('should pass through my-tab options', async () => {
    renderHook(() =>
      useCargoRequests({
        activeTab: 'my',
        filters: { city: '', cargo_type: '', price_min: '', price_max: '', price_type: '' },
        sortBy: 'date',
        userId: 'user1',
      })
    );

    expect(useInfiniteQuery).toHaveBeenCalled();
  });
});
