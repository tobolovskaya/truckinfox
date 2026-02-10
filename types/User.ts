export type UserRole = 'customer' | 'carrier' | 'admin';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};
