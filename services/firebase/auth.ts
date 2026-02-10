export async function signInWithEmail(email: string, password: string) {
  return { email, uid: 'demo-user' };
}

export async function signOut() {
  return true;
}
