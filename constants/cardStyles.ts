/**
 * Unified card styles and constants for consistent design across the app
 * Used in home.tsx (requests) and orders.tsx (orders)
 */

import { theme } from '../theme/theme';

// Card dimensions and spacing
export const CARD_STYLES = {
  borderRadius: 12, // Updated to match ui.txt spec
  padding: 16,
  marginHorizontal: 16,
  marginVertical: 6,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 3,
};

// Badge/Capsule styles (unified)
export const BADGE_STYLES = {
  borderRadius: 10, // Updated to match button spec
  paddingHorizontal: 10,
  paddingVertical: 4,
  minHeight: 22,
  minWidth: 50,
};

// Status colors with background and text (unified approach)
export const STATUS_COLORS = {
  active: {
    background: '#DCFCE7', // Very light green
    text: '#166534',       // Dark green
    icon: '#10B981',       // Medium green
  },
  in_progress: {
    background: '#FEF3C7', // Light amber
    text: '#92400E',       // Dark amber
    icon: '#F59E0B',       // Medium amber
  },
  in_transit: {
    background: '#FFE0D9', // Light orange (secondary)
    text: '#D84315',       // Dark orange
    icon: '#FF8A65',       // Medium orange (secondary)
  },
  delivered: {
    background: '#E8F5E9', // Light green
    text: '#2E7D32',       // Dark green
    icon: '#4CAF50',       // Medium green (success)
  },
  completed: {
    background: '#E8F5E9', // Light green
    text: '#2E7D32',       // Dark green
    icon: '#4CAF50',       // Medium green (success)
  },
  cancelled: {
    background: '#FFEBEE', // Light red
    text: '#C62828',       // Dark red
    icon: '#F44336',       // Medium red (error)
  },
  default: {
    background: '#FAFAFA', // Light gray
    text: '#616161',       // Medium gray (text secondary)
    icon: '#9CA3AF',       // Light gray
  },
};

// Cargo type colors (unified approach)
export const CARGO_TYPE_COLORS = {
  furniture: {
    background: '#F3E8FF', // Very light purple
    text: '#7C3AED',       // Medium purple
  },
  electronics: {
    background: '#FFE0D9', // Very light orange
    text: '#FF8A65',       // Medium orange (secondary)
  },
  construction: {
    background: '#FFF3E0', // Very light orange/amber
    text: '#FB8C00',       // Medium orange
  },
  automotive: {
    background: '#F9FAFB', // Very light gray
    text: '#6B7280',       // Medium gray
  },
  boats: {
    background: '#E0F2FE', // Very light sky blue
    text: '#0284C7',       // Medium sky blue
  },
  campingvogn: {
    background: '#FEF3C7', // Very light amber
    text: '#D97706',       // Medium amber
  },
  machinery: {
    background: '#F5F3FF', // Very light violet
    text: '#7C3AED',       // Medium violet
  },
  transport: {
    background: '#F0F9FF', // Very light sky blue
    text: '#06B6D4',       // Medium cyan
  },
  other: {
    background: '#F9FAFB', // Very light gray
    text: '#6B7280',       // Medium gray
  },
};

// Cargo type icons mapping
export const CARGO_TYPE_ICONS: { [key: string]: string } = {
  furniture: 'bed-outline',
  electronics: 'phone-portrait-outline',
  construction: 'construct-outline',
  automotive: 'car-outline',
  boats: 'boat-outline',
  campingvogn: 'home-outline',
  machinery: 'build-outline',
  transport: 'car-outline',
  other: 'cube-outline',
};

// Status labels (Norwegian)
export const STATUS_LABELS: { [key: string]: string } = {
  active: 'Aktiv',
  in_progress: 'Pågår',
  in_transit: 'Under transport',
  delivered: 'Levert',
  completed: 'Fullført',
  cancelled: 'Kansellert',
};

// Cargo type labels (Norwegian)
export const CARGO_TYPE_LABELS: { [key: string]: string } = {
  furniture: 'Møbler',
  electronics: 'Elektronikk',
  construction: 'Bygg',
  automotive: 'Bil/Motor',
  boats: 'Båter',
  campingvogn: 'Campingvogn',
  machinery: 'Maskiner',
  transport: 'Transport',
  other: 'Annet',
};

/**
 * Get status colors for a given status
 */
export const getStatusColors = (status: string) => {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.default;
};

/**
 * Get cargo type colors for a given type
 */
export const getCargoTypeColors = (type: string) => {
  return CARGO_TYPE_COLORS[type as keyof typeof CARGO_TYPE_COLORS] || CARGO_TYPE_COLORS.other;
};

/**
 * Get cargo type icon name
 */
export const getCargoTypeIcon = (type: string): string => {
  return CARGO_TYPE_ICONS[type] || 'cube-outline';
};

/**
 * Get status label
 */
export const getStatusLabel = (status: string): string => {
  return STATUS_LABELS[status] || status;
};

/**
 * Get cargo type label
 */
export const getCargoTypeLabel = (type: string): string => {
  return CARGO_TYPE_LABELS[type] || type;
};