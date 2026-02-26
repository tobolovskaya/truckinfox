import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

type CliOptions = {
  email?: string;
  revoke: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { revoke: false };

  argv.forEach(arg => {
    if (arg === '--revoke') {
      options.revoke = true;
      return;
    }

    if (arg.startsWith('--email=')) {
      options.email = arg.slice('--email='.length).trim();
      return;
    }

    if (!arg.startsWith('--') && !options.email) {
      options.email = arg.trim();
    }
  });

  return options;
}

function printUsage(): void {
  console.log('Usage:');
  console.log('  npm run admin:grant -- --email=user@example.com');
  console.log('  npm run admin:grant -- user@example.com');
  console.log('  npm run admin:revoke -- --email=user@example.com');
}

async function run(): Promise<void> {
  const { email, revoke } = parseArgs(process.argv.slice(2));

  if (!email) {
    printUsage();
    process.exit(1);
  }

  const auth = admin.auth();
  const db = admin.firestore();

  const user = await auth.getUserByEmail(email);
  const existingClaims = user.customClaims ?? {};

  const nextClaims = { ...existingClaims } as Record<string, unknown>;

  if (revoke) {
    delete nextClaims.admin;
  } else {
    nextClaims.admin = true;
  }

  await auth.setCustomUserClaims(user.uid, nextClaims);

  const userRef = db.collection('users').doc(user.uid);
  const userDoc = await userRef.get();

  if (revoke) {
    if (userDoc.exists) {
      await userRef.set({ user_type: admin.firestore.FieldValue.delete() }, { merge: true });
    }
    console.log(`âœ… Admin role revoked for ${email} (${user.uid})`);
  } else {
    await userRef.set(
      {
        email: user.email ?? email,
        user_type: 'admin',
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`âœ… Admin role granted for ${email} (${user.uid})`);
  }

  console.log('â„¹ï¸ User must refresh token (sign out/in) to receive updated custom claims.');
}

run().catch(error => {
  console.error('âŒ Failed to update admin role:', error);
  process.exit(1);
});
