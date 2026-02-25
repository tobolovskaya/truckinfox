import { renderHook, act } from '@testing-library/react-native';
import { useFilterState } from '../../hooks/useFilterState';

describe('useFilterState', () => {
  it('should initialize with empty filters', () => {
    const { result } = renderHook(() => useFilterState());

    expect(result.current.filters).toEqual({});
  });

  it('should add a single filter', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('cargo_type', 'automotive');
    });

    expect(result.current.filters.cargo_type).toBe('automotive');
  });

  it('should add multiple filters', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('cargo_type', 'automotive');
      result.current.setFilter('status', 'open');
      result.current.setFilter('min_weight', 1000);
    });

    expect(result.current.filters).toEqual({
      cargo_type: 'automotive',
      status: 'open',
      min_weight: 1000,
    });
  });

  it('should update existing filter', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('cargo_type', 'automotive');
    });

    expect(result.current.filters.cargo_type).toBe('automotive');

    act(() => {
      result.current.setFilter('cargo_type', 'general');
    });

    expect(result.current.filters.cargo_type).toBe('general');
  });

  it('should clear a single filter', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('cargo_type', 'automotive');
      result.current.setFilter('status', 'open');
    });

    act(() => {
      result.current.clearFilter('cargo_type');
    });

    expect(result.current.filters.cargo_type).toBeUndefined();
    expect(result.current.filters.status).toBe('open');
  });

  it('should clear all filters', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('cargo_type', 'automotive');
      result.current.setFilter('status', 'open');
      result.current.setFilter('min_weight', 1000);
    });

    act(() => {
      result.current.clearAllFilters();
    });

    expect(result.current.filters).toEqual({});
  });

  it('should check if filters are active', () => {
    const { result } = renderHook(() => useFilterState());

    expect(result.current.hasActiveFilters()).toBe(false);

    act(() => {
      result.current.setFilter('cargo_type', 'automotive');
    });

    expect(result.current.hasActiveFilters()).toBe(true);

    act(() => {
      result.current.clearAllFilters();
    });

    expect(result.current.hasActiveFilters()).toBe(false);
  });

  it('should count active filters', () => {
    const { result } = renderHook(() => useFilterState());

    expect(result.current.getFilterCount()).toBe(0);

    act(() => {
      result.current.setFilter('cargo_type', 'automotive');
      result.current.setFilter('status', 'open');
    });

    expect(result.current.getFilterCount()).toBe(2);

    act(() => {
      result.current.setFilter('min_weight', 1000);
    });

    expect(result.current.getFilterCount()).toBe(3);

    act(() => {
      result.current.clearFilter('cargo_type');
    });

    expect(result.current.getFilterCount()).toBe(2);
  });

  it('should handle filter ranges', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('price_min', 100);
      result.current.setFilter('price_max', 500);
    });

    expect(result.current.filters.price_min).toBe(100);
    expect(result.current.filters.price_max).toBe(500);
  });

  it('should preserve primitive values correctly', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('string_filter', 'test');
      result.current.setFilter('number_filter', 42);
      result.current.setFilter('boolean_filter', true);
    });

    expect(typeof result.current.filters.string_filter).toBe('string');
    expect(typeof result.current.filters.number_filter).toBe('number');
    expect(typeof result.current.filters.boolean_filter).toBe('boolean');
  });

  it('should handle null values', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('nullable_field', null);
    });

    expect(result.current.filters.nullable_field).toBeNull();
  });

  it('should support complex filter objects', () => {
    const { result } = renderHook(() => useFilterState());

    const complexFilter = {
      location: { lat: 59.9, lng: 10.7 },
      radius: 50,
    };

    act(() => {
      result.current.setFilter('location_filter', complexFilter);
    });

    expect(result.current.filters.location_filter).toEqual(complexFilter);
  });
});
