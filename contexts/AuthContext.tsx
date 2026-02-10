import { createContext, PropsWithChildren, useMemo, useState } from 'react';

type AuthUser = { uid: string; email: string } | null;

type AuthContextValue = {
  user: AuthUser;
  setUser: (user: AuthUser) => void;
};

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  setUser: () => undefined,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser>(null);

  const value = useMemo(() => ({ user, setUser }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
