import { VALIDATION } from '../constants';

/**
 * Validate email address
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password
 */
export const validatePassword = (password: string): boolean => {
  return password.length >= VALIDATION.MIN_PASSWORD_LENGTH;
};

/**
 * Validate phone number (international E.164 format)
 */
export const validatePhoneNumber = (phone: string): boolean => {
  // E.164 international format: + followed by country code and 6-14 digits
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Validate Norwegian organization number
 */
export const validateOrganizationNumber = (orgNumber: string): boolean => {
  // Norwegian organization numbers are 9 digits
  const orgNumberRegex = /^[0-9]{9}$/;
  return orgNumberRegex.test(orgNumber.replace(/\s/g, ''));
};

/**
 * Validate bid amount
 */
export const validateBidAmount = (amount: number): boolean => {
  return amount >= VALIDATION.MIN_BID_AMOUNT && amount <= VALIDATION.MAX_BID_AMOUNT;
};

/**
 * Validate cargo weight
 */
export const validateCargoWeight = (weight: number): boolean => {
  return weight >= VALIDATION.MIN_CARGO_WEIGHT && weight <= VALIDATION.MAX_CARGO_WEIGHT;
};

/**
 * Validate required field
 */
export const validateRequired = (value: string | number | null | undefined): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
};

export default {
  validateEmail,
  validatePassword,
  validatePhoneNumber,
  validateOrganizationNumber,
  validateBidAmount,
  validateCargoWeight,
  validateRequired,
};
