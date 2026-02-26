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
if (!admin.apps.length) {
    admin.initializeApp();
}
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
        if (!arg.startsWith('--') && !options.email) {
            options.email = arg.trim();
        }
    });
    return options;
}
function printUsage() {
    console.log('Usage:');
    console.log('  npm run admin:grant -- --email=user@example.com');
    console.log('  npm run admin:grant -- user@example.com');
    console.log('  npm run admin:revoke -- --email=user@example.com');
}
async function run() {
    var _a, _b;
    const { email, revoke } = parseArgs(process.argv.slice(2));
    if (!email) {
        printUsage();
        process.exit(1);
    }
    const auth = admin.auth();
    const db = admin.firestore();
    const user = await auth.getUserByEmail(email);
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
        console.log(`✅ Admin role revoked for ${email} (${user.uid})`);
    }
    else {
        await userRef.set({
            email: (_b = user.email) !== null && _b !== void 0 ? _b : email,
            user_type: 'admin',
            updated_at: new Date().toISOString(),
        }, { merge: true });
        console.log(`✅ Admin role granted for ${email} (${user.uid})`);
    }
    console.log('ℹ️ User must refresh token (sign out/in) to receive updated custom claims.');
}
run().catch(error => {
    console.error('❌ Failed to update admin role:', error);
    process.exit(1);
});
//# sourceMappingURL=setAdminRole.js.map