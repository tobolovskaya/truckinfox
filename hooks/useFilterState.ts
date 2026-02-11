import { useReducer } from 'react';

export interface FilterState {
  city: string;
  cargo_type: string;
  price_min: string;
  price_max: string;
  price_type: string;
  priceRange: { min: string; max: string };
  weightRange: { min: string; max: string };
  pickupDate: string;
  citySearch: string;
}

export interface TempFilterState extends FilterState {
  isModalVisible: boolean;
}

type FilterAction =
  | { type: 'SET_CITY'; payload: string }
  | { type: 'SET_CARGO_TYPE'; payload: string }
  | { type: 'SET_PRICE_MIN'; payload: string }
  | { type: 'SET_PRICE_MAX'; payload: string }
  | { type: 'SET_PRICE_TYPE'; payload: string }
  | { type: 'SET_PRICE_RANGE'; payload: { min: string; max: string } }
  | { type: 'SET_WEIGHT_RANGE'; payload: { min: string; max: string } }
  | { type: 'SET_PICKUP_DATE'; payload: string }
  | { type: 'SET_CITY_SEARCH'; payload: string }
  | { type: 'OPEN_MODAL' }
  | { type: 'CLOSE_MODAL' }
  | { type: 'APPLY_FILTERS'; payload: Partial<FilterState> }
  | { type: 'RESET_FILTERS' }
  | { type: 'CLEAR_FILTER'; payload: keyof FilterState };

const initialState: TempFilterState = {
  city: '',
  cargo_type: '',
  price_min: '',
  price_max: '',
  price_type: '',
  priceRange: { min: '', max: '' },
  weightRange: { min: '', max: '' },
  pickupDate: '',
  citySearch: '',
  isModalVisible: false,
};

function filterReducer(state: TempFilterState, action: FilterAction): TempFilterState {
  switch (action.type) {
    case 'SET_CITY':
      return { ...state, city: action.payload };

    case 'SET_CARGO_TYPE':
      return { ...state, cargo_type: action.payload };

    case 'SET_PRICE_MIN':
      return { ...state, price_min: action.payload };

    case 'SET_PRICE_MAX':
      return { ...state, price_max: action.payload };

    case 'SET_PRICE_TYPE':
      return { ...state, price_type: action.payload };

    case 'SET_PRICE_RANGE':
      return { ...state, priceRange: action.payload };

    case 'SET_WEIGHT_RANGE':
      return { ...state, weightRange: action.payload };

    case 'SET_PICKUP_DATE':
      return { ...state, pickupDate: action.payload };

    case 'SET_CITY_SEARCH':
      return { ...state, citySearch: action.payload };

    case 'OPEN_MODAL':
      return { ...state, isModalVisible: true };

    case 'CLOSE_MODAL':
      return { ...state, isModalVisible: false };

    case 'APPLY_FILTERS':
      return {
        ...state,
        ...action.payload,
        isModalVisible: false,
      };

    case 'RESET_FILTERS':
      return {
        ...initialState,
        isModalVisible: state.isModalVisible,
      };

    case 'CLEAR_FILTER':
      return {
        ...state,
        [action.payload]: action.payload === 'priceRange' || action.payload === 'weightRange'
          ? { min: '', max: '' }
          : '',
      };

    default:
      return state;
  }
}

export function useFilterState() {
  const [state, dispatch] = useReducer(filterReducer, initialState);

  return {
    filterState: state,
    dispatch,
    // Convenience methods
    setCity: (city: string) => dispatch({ type: 'SET_CITY', payload: city }),
    setCargoType: (cargoType: string) => dispatch({ type: 'SET_CARGO_TYPE', payload: cargoType }),
    setPriceMin: (price: string) => dispatch({ type: 'SET_PRICE_MIN', payload: price }),
    setPriceMax: (price: string) => dispatch({ type: 'SET_PRICE_MAX', payload: price }),
    setPriceType: (priceType: string) => dispatch({ type: 'SET_PRICE_TYPE', payload: priceType }),
    setPriceRange: (range: { min: string; max: string }) => dispatch({ type: 'SET_PRICE_RANGE', payload: range }),
    setWeightRange: (range: { min: string; max: string }) => dispatch({ type: 'SET_WEIGHT_RANGE', payload: range }),
    setPickupDate: (date: string) => dispatch({ type: 'SET_PICKUP_DATE', payload: date }),
    setCitySearch: (search: string) => dispatch({ type: 'SET_CITY_SEARCH', payload: search }),
    openModal: () => dispatch({ type: 'OPEN_MODAL' }),
    closeModal: () => dispatch({ type: 'CLOSE_MODAL' }),
    applyFilters: (filters: Partial<FilterState>) => dispatch({ type: 'APPLY_FILTERS', payload: filters }),
    resetFilters: () => dispatch({ type: 'RESET_FILTERS' }),
    clearFilter: (key: keyof FilterState) => dispatch({ type: 'CLEAR_FILTER', payload: key }),
  };
}
