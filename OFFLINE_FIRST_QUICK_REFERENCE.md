# Offline-First Quick Reference

Quick lookup guide for common offline-first operations.

## In Components

### Monitor Sync Status
```typescript
const { syncStatus, pendingCount, syncNow } = useSyncStatus();
```

### Monitor Network Status
```typescript
const { isConnected, type } = useNetworkStatus();
```

## In Data Operations

### Create Document
```typescript
// Before: await addDoc(collection(db, 'users'), data);
// After:
const result = await safeAddDoc('users', data);
if (result.success) console.log('ID:', result.id);
```

### Read Document
```typescript
// Before: const snap = await getDoc(doc(db, 'users', id));
// After:
const result = await safeGetDoc('users', id);
if (result.success) {
  console.log(result.data);
  console.log(result.fromCache ? 'Cached' : 'Fresh');
}
```

### Update Document
```typescript
// Before: await updateDoc(doc(db, 'users', id), { name: 'John' });
// After:
const result = await safeUpdateDoc('users', id, { name: 'John' });
```

### Delete Document
```typescript
// Before: await deleteDoc(doc(db, 'users', id));
// After:
const result = await safeDeleteDoc('users', id);
```

### Query Collection
```typescript
// Before: const snap = await getDocs(query(collection(db, 'users'), where(...)));
// After:
import { where } from 'firebase/firestore';
const result = await safeQuery('users', [where('status', '==', 'active')]);
if (result.success) console.log(result.documents);
```

### Batch Operations
```typescript
const result = await safeBatchWrite([
  { type: 'set', collection: 'users', id: userId, data: { active: true } },
  { type: 'update', collection: 'system', id: 'stats', data: { users: increment(1) } },
  { type: 'delete', collection: 'temp', id: tempId }
]);
```

## Display Patterns

### Show Sync Status
```typescript
{syncStatus === 'syncing' && <Text>🔄 Syncing...</Text>}
{syncStatus === 'pending' && <Text>⏱️ {pendingCount} pending</Text>}
{syncStatus === 'synced' && <Text>✅ Synced</Text>}
```

### Show Network Status
```typescript
{!isConnected && <Text>📴 Offline</Text>}
{isConnected && <Text>📡 {type}</Text>}
```

### Show Save Status
```typescript
const result = await safeSetDoc('collection', id, data);
showToast(
  result.success 
    ? (result.fromCache ? 'Saving...' : 'Saved!')
    : `Error: ${result.error}`
);
```

## Testing Offline

### Simulate Offline
```typescript
// Disable network on device/emulator
```

### Check Queue
```typescript
import { getPendingOfflineOperations, getOfflineQueueStats } from '../lib/offlineSync';

console.log(getPendingOfflineOperations());
console.log(getOfflineQueueStats());
```

### Trigger Sync
```typescript
const { syncNow } = useSyncStatus();
await syncNow();
```

## Common Scenarios

### Save User Profile (Async with Offline)
```typescript
async function saveProfile(userId, profileData) {
  const result = await safeSetDoc('users', userId, profileData);
  
  if (result.success) {
    Toast.show(
      result.fromCache 
        ? 'Profile saved locally' 
        : 'Profile updated'
    );
  } else {
    Toast.error(result.error);
  }
}
```

### Accept Bid (Atomic Update)
```typescript
async function acceptBid(bidId, requestId) {
  const result = await safeBatchWrite([
    { type: 'update', collection: 'bids', id: bidId, data: { status: 'accepted' } },
    { type: 'update', collection: 'requests', id: requestId, data: { bidAccepted: bidId } }
  ]);
  
  if (result.success) {
    Toast.show(result.queued ? 'Queued for sync' : 'Updated');
  }
}
```

### Send Message with Local Display
```typescript
async function sendMessage(conversationId, text) {
  // Add to local state immediately
  const tempId = generateId();
  setMessages([...messages, { id: tempId, text, pending: true }]);
  
  // Queue to Firestore
  const result = await safeAddDoc('messages', {
    conversationId,
    text,
    createdAt: serverTimestamp()
  });
  
  if (result.success) {
    // Update local ID if offline
    updateMessageId(tempId, result.id);
  }
}
```

### Load Data with Fallback
```typescript
async function loadUser(userId) {
  const result = await safeGetDoc('users', userId);
  
  if (result.success) {
    // Use data (from cloud if online or cache if offline)
    return result.data;
  } else {
    // Show error
    Toast.error('Failed to load user');
    return null;
  }
}
```

## Response Checks

### Check Success
```typescript
if (result.success) {
  // Operation executed or queued
}
```

### Check Cache Source
```typescript
if (result.fromCache) {
  // Data is from local cache (offline)
  // May be outdated
}
```

### Check Existence
```typescript
if (result.success && result.exists) {
  // Document exists
}
```

### Handle Errors
```typescript
if (!result.success) {
  console.error(result.error);
  // Operation failed even offline
}
```

## Debug Helpers

### Log All Pending Operations
```typescript
const ops = getPendingOfflineOperations();
ops.forEach(op => {
  console.log(`${op.operation} ${op.collectionName}/${op.documentId}`);
});
```

### Log Queue Stats
```typescript
const stats = getOfflineQueueStats();
console.log(`Total: ${stats.total}`);
console.log(`Creates: ${stats.byOperation.create}`);
console.log(`Updates: ${stats.byOperation.update}`);
console.log(`Deletes: ${stats.byOperation.delete}`);
```

### Log Sync Status
```typescript
const status = getSyncStatus();
console.log(`Status: ${status.status}`);
console.log(`Pending: ${status.pendingCount}`);
console.log(`Online: ${status.isOnline}`);
```

### Log Network
```typescript
const network = useNetworkStatus();
console.log(`Connected: ${network.isConnected}`);
console.log(`Type: ${network.type}`);
console.log(`Strength: ${network.strength}%`);
```

## File Map

| File | Purpose | Key Exports |
|------|---------|--------------|
| `lib/firebase.ts` | Firebase initialization | `db`, `auth`, `storage` |
| `lib/offlineSync.ts` | Queue management | `safeSetDoc`, `safeQuery`, ... |
| `lib/safeFirestoreOps.ts` | Safe Firestore ops | 7 safe* functions |
| `hooks/useSyncStatus.ts` | Sync monitoring | `useSyncStatus()` |
| `hooks/useNetworkStatus.ts` | Network monitoring | `useNetworkStatus()` |
| `components/NetworkStatusBar.tsx` | Network UI | Display component |

## Imports Cheat Sheet

### Safe Operations
```typescript
import {
  safeSetDoc,
  safeUpdateDoc,
  safeDeleteDoc,
  safeGetDoc,
  safeQuery,
  safeAddDoc,
  safeBatchWrite
} from '../lib/safeFirestoreOps';
```

### Queue Management
```typescript
import {
  queueOfflineOperation,
  syncOfflineQueue,
  getPendingOfflineOperations,
  getOfflineQueueStats,
  initializeOfflineSync,
  getSyncStatus,
  clearOfflineQueue
} from '../lib/offlineSync';
```

### Hooks
```typescript
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
```

### Firebase (when needed)
```typescript
import { serverTimestamp, increment } from 'firebase/firestore';
import { where, orderBy, limit } from 'firebase/firestore';
```

## Response Type Quick Ref

```typescript
// SafeDocResult
{ success: boolean; fromCache?: boolean; error?: string; }

// SafeGetResult
{ success; data?; exists?; fromCache?; error?; }

// SafeQueryResult
{ success; documents?; fromCache?; error?; }

// SafeAddResult
{ success; id?; fromCache?; error?; }

// SafeBatchResult
{ success; queued?; error?; }
```

## Performance Tips

1. **Batch writes** - Group related updates
2. **Query limits** - Use `limit()` to reduce data
3. **Offline checks** - Read `isConnected` before CPU-heavy ops
4. **Sync timing** - Let auto-sync handle most cases
5. **Cache size** - Clear old data periodically
6. **Error handling** - Always check `result.success`

## Do's and Don'ts

✅ **Do:**
- Use safe* wrappers for all Firestore ops
- Show sync status to users
- Handle `fromCache` responses
- Test offline scenarios
- Use batch writes for related ops

❌ **Don't:**
- Call Firebase functions directly (use safe wrappers)
- Ignore `success` flag in responses
- Assume online operation succeeded
- Queue 1000+ operations
- Update UI before checking result

## Error Messages

| Message | Fix |
|---------|-----|
| "Offline persistence not available" | Browser storage full or disabled |
| "PERMISSION_DENIED" | Check Firestore security rules |
| "INVALID_ARGUMENT" | Validate document data |
| "Collection not found" | Check collection name spelling |
| "Document not found" | Document was deleted or ID wrong |

## Limits & Constraints

- **Queue size**: Keep < 500 operations
- **Document size**: Max 1MB per document
- **Write batch**: Max 500 operations per batch
- **Retries**: 3 attempts per operation (1s, 2s, 4s delays)
- **Cache**: Platform-dependent on mobile
- **Timeout**: 10s per operation attempt

