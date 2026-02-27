import { supabase } from '../lib/supabase';

type DocumentData = Record<string, unknown>;
type Firestore = unknown;

/**
 * Search utilities for generating searchable terms.
 */

/**
 * Generate search terms from a full name
 *
 * Creates an array of lowercase search terms including:
 * - Full name
 * - Individual words
 * - Common variations
 *
 * @param fullName - User's full name (e.g., "John Doe")
 * @returns Array of searchable terms (e.g., ["john", "doe", "john doe"])
 *
 * @example
 * generateSearchTerms("John Doe");
 * // Returns: ["john", "doe", "john doe"]
 *
 * generateSearchTerms("Mary Jane Watson");
 * // Returns: ["mary", "jane", "watson", "mary jane", "jane watson", "mary jane watson"]
 */
export function generateSearchTerms(fullName: string): string[] {
  if (!fullName || typeof fullName !== 'string') {
    return [];
  }

  const normalized = fullName.toLowerCase().trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(/\s+/).filter(word => word.length > 0);
  const terms = new Set<string>();

  // Add individual words
  words.forEach(word => {
    terms.add(word);
  });

  // Add full name
  terms.add(normalized);

  // Add consecutive word pairs (for names with 3+ words)
  if (words.length >= 2) {
    for (let i = 0; i < words.length - 1; i++) {
      terms.add(`${words[i]} ${words[i + 1]}`);
    }
  }

  // Add all prefixes of each word (for partial matching)
  // For example: "john" -> ["j", "jo", "joh", "john"]
  words.forEach(word => {
    if (word.length >= 2) {
      for (let i = 2; i <= word.length; i++) {
        terms.add(word.substring(0, i));
      }
    }
  });

  return Array.from(terms);
}

/**
 * Generate search terms for cargo request
 *
 * Creates an array of lowercase search terms including:
 * - Title words
 * - Cargo type
 * - Pickup/delivery locations
 *
 * @param title - Cargo request title
 * @param cargoType - Type of cargo
 * @param pickupLocation - Pickup city/location
 * @param deliveryLocation - Delivery city/location
 * @returns Array of searchable terms
 *
 * @example
 * generateCargoSearchTerms("Moving furniture", "furniture", "Oslo", "Bergen");
 * // Returns: ["moving", "furniture", "oslo", "bergen", "moving furniture", ...]
 */
export function generateCargoSearchTerms(
  title?: string,
  cargoType?: string,
  pickupLocation?: string,
  deliveryLocation?: string
): string[] {
  const terms = new Set<string>();

  // Add title terms
  if (title) {
    generateSearchTerms(title).forEach(term => terms.add(term));
  }

  // Add cargo type
  if (cargoType) {
    terms.add(cargoType.toLowerCase());
  }

  // Add locations
  if (pickupLocation) {
    generateSearchTerms(pickupLocation).forEach(term => terms.add(term));
  }

  if (deliveryLocation) {
    generateSearchTerms(deliveryLocation).forEach(term => terms.add(term));
  }

  return Array.from(terms);
}

/**
 * Normalize search query for text search
 *
 * @param query - Raw search query from user input
 * @returns Normalized lowercase search term
 *
 * @example
 * normalizeSearchQuery("  John Doe  ");
 * // Returns: "john doe"
 */
export function normalizeSearchQuery(query: string): string {
  return query.toLowerCase().trim();
}

/**
 * Search profiles by name using Supabase
 *
 * This provides server-side search using `ilike` filters.
 * Works well for datasets with 1000+ items where client-side filtering
 * would be slow.
 *
 * @param db - Firestore database instance
 * @param searchQuery - User's search query
 * @param limit - Maximum number of results (default: 20)
 * @returns Array of matching user documents
 *
 * @example
 * const users = await searchUsers(undefined, "john", 10);
 * // Returns up to 10 users with "john" in their name
 *
 * @note Uses Supabase profiles table
 */
export async function searchUsers(
  db: Firestore,
  searchQuery: string,
  limit: number = 20
): Promise<Array<{ id: string } & DocumentData>> {
  void db;

  if (!searchQuery || searchQuery.trim().length === 0) {
    return [];
  }

  const normalizedQuery = normalizeSearchQuery(searchQuery);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`full_name.ilike.%${normalizedQuery}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []).map(row => {
      const mapped = row as Record<string, unknown>;
      return {
        id: String(mapped.id),
        ...mapped,
      };
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

/**
 * Search cargo requests by title and location
 *
 * @param db - Firestore database instance
 * @param searchQuery - User's search query
 * @param limit - Maximum number of results (default: 20)
 * @returns Array of matching cargo request documents
 *
 * @example
 * const requests = await searchCargoRequests(undefined, "furniture oslo", 10);
 * // Returns up to 10 cargo requests matching "furniture oslo"
 *
 */
export async function searchCargoRequests(
  db: Firestore,
  searchQuery: string,
  limit: number = 20
): Promise<Array<{ id: string } & DocumentData>> {
  void db;

  if (!searchQuery || searchQuery.trim().length === 0) {
    return [];
  }

  const normalizedQuery = normalizeSearchQuery(searchQuery);

  try {
    const { data, error } = await supabase
      .from('cargo_requests')
      .select('*')
      .in('status', ['open', 'active', 'bidding'])
      .or(
        `title.ilike.%${normalizedQuery}%,description.ilike.%${normalizedQuery}%,from_address.ilike.%${normalizedQuery}%,to_address.ilike.%${normalizedQuery}%,cargo_type.ilike.%${normalizedQuery}%`
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []).map(row => {
      const mapped = row as Record<string, unknown>;
      return {
        id: String(mapped.id),
        ...mapped,
      };
    });
  } catch (error) {
    console.error('Error searching cargo requests:', error);
    return [];
  }
}
