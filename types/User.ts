export interface User {
  id: string;
  email: string;
  phone: string;
  profileType: 'customer' | 'carrier';
  createdAt: Date;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
  customerProfile?: CustomerProfile;
  carrierProfile?: CarrierProfile;
}

export interface CustomerProfile {
  name: string;
  city: string;
  avatar?: string;
  orderHistory: string[]; // Order IDs
}

export interface CarrierProfile {
  companyName: string;
  organizationNumber: string; // Organisasjonsnummer (Norway)
  description: string;
  specializations: string[];
  logo?: string;
  vehiclePhotos?: string[];
  isVerified: boolean; // Verified by Brønnøysundregistrene
  completedJobs: number;
  verificationDate?: Date;
}
