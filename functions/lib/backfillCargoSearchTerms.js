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
const PAGE_SIZE = 300;
const BATCH_SIZE = 450;
function generateSearchTerms(input) {
    if (!input || typeof input !== 'string') {
        return [];
    }
    const normalized = input.toLowerCase().trim();
    if (!normalized) {
        return [];
    }
    const words = normalized.split(/\s+/).filter(Boolean);
    const terms = new Set();
    words.forEach(word => {
        terms.add(word);
        if (word.length >= 2) {
            for (let i = 2; i <= word.length; i += 1) {
                terms.add(word.slice(0, i));
            }
        }
    });
    terms.add(normalized);
    if (words.length >= 2) {
        for (let i = 0; i < words.length - 1; i += 1) {
            terms.add(`${words[i]} ${words[i + 1]}`);
        }
    }
    return Array.from(terms);
}
function generateCargoSearchTerms(data) {
    var _a, _b, _c;
    const terms = new Set();
    generateSearchTerms((_a = data.title) !== null && _a !== void 0 ? _a : '').forEach(term => terms.add(term));
    generateSearchTerms((_b = data.from_address) !== null && _b !== void 0 ? _b : '').forEach(term => terms.add(term));
    generateSearchTerms((_c = data.to_address) !== null && _c !== void 0 ? _c : '').forEach(term => terms.add(term));
    if (data.cargo_type) {
        terms.add(data.cargo_type.toLowerCase().trim());
    }
    return Array.from(terms).sort();
}
function arraysEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
async function run() {
    var _a;
    const applyChanges = process.argv.includes('--apply');
    const db = admin.firestore();
    console.log(`Mode: ${applyChanges ? 'APPLY' : 'DRY-RUN'}`);
    let scanned = 0;
    let needsUpdate = 0;
    let updated = 0;
    let lastDoc = null;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        let pageQuery = db
            .collection('cargo_requests')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PAGE_SIZE);
        if (lastDoc) {
            pageQuery = pageQuery.startAfter(lastDoc);
        }
        const snapshot = await pageQuery.get();
        if (snapshot.empty) {
            break;
        }
        scanned += snapshot.size;
        const pendingUpdates = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const nextTerms = generateCargoSearchTerms(data);
            const currentTerms = Array.isArray(data.search_terms)
                ? [...data.search_terms].map(value => String(value)).sort()
                : [];
            if (!arraysEqual(currentTerms, nextTerms)) {
                needsUpdate += 1;
                pendingUpdates.push({ ref: doc.ref, terms: nextTerms });
            }
        });
        if (applyChanges && pendingUpdates.length > 0) {
            for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
                const chunk = pendingUpdates.slice(i, i + BATCH_SIZE);
                const batch = db.batch();
                chunk.forEach(item => {
                    batch.update(item.ref, { search_terms: item.terms });
                });
                await batch.commit();
                updated += chunk.length;
            }
        }
        lastDoc = (_a = snapshot.docs[snapshot.docs.length - 1]) !== null && _a !== void 0 ? _a : null;
        console.log(`Processed: ${scanned}, pending updates: ${needsUpdate}, applied updates: ${updated}`);
    }
    console.log('Done.');
    console.log(`Total scanned: ${scanned}`);
    console.log(`Total needing update: ${needsUpdate}`);
    console.log(`Total updated: ${updated}`);
    if (!applyChanges) {
        console.log('Run with --apply to write changes.');
    }
}
run().catch(error => {
    console.error('Backfill failed:', error);
    process.exit(1);
});
//# sourceMappingURL=backfillCargoSearchTerms.js.map