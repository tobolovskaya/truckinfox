import { renderHook, act } from '@testing-library/react-native';
import { useFilterState } from '../../hooks/useFilterState';

describe('useFilterState', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useFilterState());

    expect(result.current.filterState).toMatchObject({
      city: '',
      cargo_type: '',
      price_min: '',
      price_max: '',
      price_type: '',
      pickupDate: '',
      citySearch: '',
      isModalVisible: false,
    });
  });

  it('should update cargo type', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setCargoType('automotive');
    });

    expect(result.current.filterState.cargo_type).toBe('automotive');
  });

  it('should update multiple fields', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setCity('Oslo');
      result.current.setCargoType('automotive');
      result.current.setPriceMin('1000');
      result.current.setPriceMax('5000');
      result.current.setPriceType('fixed');
    });

    expect(result.current.filterState).toMatchObject({
      city: 'Oslo',
      cargo_type: 'automotive',
      price_min: '1000',
      price_max: '5000',
      price_type: 'fixed',
    });
  });

  it('should apply filters and close modal', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.openModal();
    });

    expect(result.current.filterState.isModalVisible).toBe(true);

    act(() => {
      result.current.applyFilters({ city: 'Bergen', cargo_type: 'general' });
    });

    expect(result.current.filterState.city).toBe('Bergen');
    expect(result.current.filterState.cargo_type).toBe('general');
    expect(result.current.filterState.isModalVisible).toBe(false);
  });

  it('should clear a single filter field', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setCargoType('automotive');
      result.current.setCity('Trondheim');
    });

    act(() => {
      result.current.clearFilter('cargo_type');
    });

    expect(result.current.filterState.cargo_type).toBe('');
    expect(result.current.filterState.city).toBe('Trondheim');
  });

  it('should reset filters while preserving modal state', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setCargoType('automotive');
      result.current.setCity('Oslo');
      result.current.openModal();
    });

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filterState.cargo_type).toBe('');
    expect(result.current.filterState.city).toBe('');
    expect(result.current.filterState.isModalVisible).toBe(true);
  });

  it('should manage modal visibility', () => {
    const { result } = renderHook(() => useFilterState());

    expect(result.current.filterState.isModalVisible).toBe(false);

    act(() => {
      result.current.openModal();
    });

    expect(result.current.filterState.isModalVisible).toBe(true);

    act(() => {
      result.current.closeModal();
    });

    expect(result.current.filterState.isModalVisible).toBe(false);
  });

  it('should support range fields', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setPriceRange({ min: '100', max: '500' });
      result.current.setWeightRange({ min: '10', max: '1000' });
    });

    expect(result.current.filterState.priceRange).toEqual({ min: '100', max: '500' });
    expect(result.current.filterState.weightRange).toEqual({ min: '10', max: '1000' });
  });
});
