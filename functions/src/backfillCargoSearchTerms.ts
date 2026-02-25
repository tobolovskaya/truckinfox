import * as admin from 'firebase-admin';
import { firestore } from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const PAGE_SIZE = 300;
const BATCH_SIZE = 450;

type CargoRequestDoc = {
  title?: string;
  cargo_type?: string;
  from_address?: string;
  to_address?: string;
  search_terms?: string[];
};

function generateSearchTerms(input: string): string[] {
  if (!input || typeof input !== 'string') {
    return [];
  }

  const normalized = input.toLowerCase().trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const terms = new Set<string>();

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

function generateCargoSearchTerms(data: CargoRequestDoc): string[] {
  const terms = new Set<string>();

  generateSearchTerms(data.title ?? '').forEach(term => terms.add(term));
  generateSearchTerms(data.from_address ?? '').forEach(term => terms.add(term));
  generateSearchTerms(data.to_address ?? '').forEach(term => terms.add(term));

  if (data.cargo_type) {
    terms.add(data.cargo_type.toLowerCase().trim());
  }

  return Array.from(terms).sort();
}

function arraysEqual(a: string[], b: string[]): boolean {
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

async function run(): Promise<void> {
  const applyChanges = process.argv.includes('--apply');
  const db = admin.firestore();

  console.log(`Mode: ${applyChanges ? 'APPLY' : 'DRY-RUN'}`);

  let scanned = 0;
  let needsUpdate = 0;
  let updated = 0;

  let lastDoc: firestore.QueryDocumentSnapshot | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let pageQuery: firestore.Query = db
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

    const pendingUpdates: Array<{ ref: firestore.DocumentReference; terms: string[] }> = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data() as CargoRequestDoc;
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

    lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;

    console.log(
      `Processed: ${scanned}, pending updates: ${needsUpdate}, applied updates: ${updated}`
    );
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
