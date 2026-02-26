"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function parseArgs(argv) {
    const options = { revoke: false };
    argv.forEach(arg => {
        if (arg === '--revoke') {
            options.revoke = true;
            return;
        }
        if (arg.startsWith('--email=')) {
            options.email = arg.slice('--email='.length).trim();
            return;
        }
        if (arg.startsWith('--uid=')) {
            options.uid = arg.slice('--uid='.length).trim();
            return;
        }
        if (arg.startsWith('--project=')) {
            options.projectId = arg.slice('--project='.length).trim();
            return;
        }
        if (arg.startsWith('--credentials=')) {
            options.credentialsPath = arg.slice('--credentials='.length).trim();
            return;
        }
        if (!arg.startsWith('--') && !options.email) {
            options.email = arg.trim();
        }
    });
    return options;
}
function printUsage() {
    console.log('Usage:');
    console.log('  npm run admin:grant -- --uid=<firebase-auth-uid>');
    console.log('  npm run admin:grant -- --email=user@example.com');
    console.log('  npm run admin:grant -- --email=user@example.com --project=your-firebase-project');
    console.log('  npm run admin:grant -- --email=user@example.com --credentials=./service-account.json');
    console.log('  npm run admin:grant -- user@example.com');
    console.log('  npm run admin:revoke -- --uid=<firebase-auth-uid>');
    console.log('  npm run admin:revoke -- --email=user@example.com');
}
function initializeFirebase(options) {
    if (admin.apps.length) {
        return;
    }
    const projectId = options.projectId ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT ||
        process.env.FIREBASE_PROJECT_ID;
    let credential;
    const credentialsPath = options.credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credentialsPath) {
        const absolutePath = path.isAbsolute(credentialsPath)
            ? credentialsPath
            : path.resolve(process.cwd(), credentialsPath);
        const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
        credential = admin.credential.cert(serviceAccount);
    }
    else {
        credential = admin.credential.applicationDefault();
    }
    admin.initializeApp(Object.assign({ credential }, (projectId ? { projectId } : {})));
}
async function run() {
    var _a, _b;
    const options = parseArgs(process.argv.slice(2));
    const { uid, email, revoke } = options;
    const normalizedEmail = email === null || email === void 0 ? void 0 : email.trim().toLowerCase();
    if (!normalizedEmail && !uid) {
        printUsage();
        process.exit(1);
    }
    initializeFirebase(options);
    const auth = admin.auth();
    const db = admin.firestore();
    try {
        if (!normalizedEmail) {
            throw new Error('Email is required for Auth API lookup');
        }
        const user = await auth.getUserByEmail(normalizedEmail);
        const existingClaims = (_a = user.customClaims) !== null && _a !== void 0 ? _a : {};
        const nextClaims = Object.assign({}, existingClaims);
        if (revoke) {
            delete nextClaims.admin;
        }
        else {
            nextClaims.admin = true;
        }
        await auth.setCustomUserClaims(user.uid, nextClaims);
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        if (revoke) {
            if (userDoc.exists) {
                await userRef.set({ user_type: admin.firestore.FieldValue.delete() }, { merge: true });
            }
            console.log(`✅ Admin role revoked for ${normalizedEmail} (${user.uid})`);
        }
        else {
            await userRef.set({
                email: (_b = user.email) !== null && _b !== void 0 ? _b : normalizedEmail,
                user_type: 'admin',
                updated_at: new Date().toISOString(),
            }, { merge: true });
            console.log(`✅ Admin role granted for ${normalizedEmail} (${user.uid})`);
        }
        console.log('ℹ️ User must refresh token (sign out/in) to receive updated custom claims.');
        return;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const canFallbackToFirestore = (!normalizedEmail && Boolean(uid)) ||
            message.includes('PERMISSION_DENIED') ||
            message.includes('serviceusage.services.use') ||
            message.includes('USER_PROJECT_DENIED');
        if (!canFallbackToFirestore) {
            throw error;
        }
        console.warn('⚠️ Auth API permissions are missing. Falling back to Firestore-only admin update.');
        if (!normalizedEmail && uid) {
            const userRef = db.collection('users').doc(uid);
            if (revoke) {
                await userRef.set({ user_type: admin.firestore.FieldValue.delete() }, { merge: true });
                console.log(`✅ Admin role revoked in Firestore for UID ${uid}`);
            }
            else {
                await userRef.set({
                    user_type: 'admin',
                    updated_at: new Date().toISOString(),
                }, { merge: true });
                console.log(`✅ Admin role granted in Firestore for UID ${uid}`);
            }
            console.log('ℹ️ Custom claims were not updated due to IAM permissions.');
            console.log('ℹ️ App access works because admin check uses users.user_type === "admin".');
            return;
        }
        const usersSnap = await db
            .collection('users')
            .where('email', '==', normalizedEmail)
            .limit(1)
            .get();
        if (usersSnap.empty) {
            if (!uid) {
                throw new Error(`No user document found in Firestore for email ${normalizedEmail}. ` +
                    'Provide --uid=<firebase-auth-uid> or create the user profile document first.');
            }
            const userRef = db.collection('users').doc(uid);
            if (revoke) {
                await userRef.set({ user_type: admin.firestore.FieldValue.delete() }, { merge: true });
                console.log(`✅ Admin role revoked in Firestore for UID ${uid}`);
            }
            else {
                const payload = {
                    user_type: 'admin',
                    updated_at: new Date().toISOString(),
                };
                if (normalizedEmail) {
                    payload.email = normalizedEmail;
                }
                await userRef.set(payload, { merge: true });
                console.log(`✅ Admin role granted in Firestore for UID ${uid}`);
            }
            console.log('ℹ️ Custom claims were not updated due to IAM permissions.');
            console.log('ℹ️ App access works because admin check uses users.user_type === "admin".');
            return;
        }
        const userDoc = usersSnap.docs[0];
        const userRef = userDoc.ref;
        if (revoke) {
            await userRef.set({ user_type: admin.firestore.FieldValue.delete() }, { merge: true });
            console.log(`✅ Admin role revoked in Firestore for ${normalizedEmail} (${userDoc.id})`);
        }
        else {
            await userRef.set({
                email: normalizedEmail,
                user_type: 'admin',
                updated_at: new Date().toISOString(),
            }, { merge: true });
            console.log(`✅ Admin role granted in Firestore for ${normalizedEmail} (${userDoc.id})`);
        }
        console.log('ℹ️ Custom claims were not updated due to IAM permissions.');
        console.log('ℹ️ App access works because admin check uses users.user_type === "admin".');
    }
}
run().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    const isCredentialError = message.includes('Failed to determine project ID');
    if (isCredentialError) {
        console.error('❌ Failed to update admin role: missing Google credentials/project for local run.');
        console.error('Set one of these before running:');
        console.error('1) --credentials=./service-account.json --project=your-firebase-project');
        console.error('2) Env vars: GOOGLE_APPLICATION_CREDENTIALS + GOOGLE_CLOUD_PROJECT');
        console.error('Windows PowerShell example: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\service-account.json"; $env:GOOGLE_CLOUD_PROJECT="your-firebase-project"');
    }
    console.error('❌ Failed to update admin role:', error);
    process.exit(1);
});
//# sourceMappingURL=setAdminRole.js.map