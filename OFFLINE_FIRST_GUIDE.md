# Offline-First Architecture with Firestore Persistence

**Date**: February 25, 2026  
**Status**: ✅ Complete  
**Features**: Automatic offline caching, sync queuing, data persistence

## Overview

The app now supports seamless offline-first functionality using Firebase Firestore persistence. Users can continue working even without an internet connection, and their changes are automatically synced when connection is restored.

## Features

### ✅ Automatic Offline Persistence
- **React Native**: Built-in SDK persistence

### ✅ Offline Operation Queuing
- Automatic queuing of Firestore operations when offline
- Exponential retry strategy with max 3 retries
- Manual sync trigger and automatic sync on reconnect

### ✅ Offline-First Queries
- All queries serve from local cache when offline
- Seamless transition between online/offline queries
- Clear visual indicators showing data source

### ✅ Network Status Tracking
- Real-time connectivity monitoring
- Sync status display with pending count
- Error tracking and reporting

## Architecture

### Files Added

```
lib/
├── offlineSync.ts              # Offline queue management & sync logic
├── safeFirestoreOps.ts         # Safe Firestore operations with fallback
└── firebase.ts                 # Updated with persistence initialization

hooks/
└── useSyncStatus.ts            # Hook to monitor sync status

components/
└── NetworkStatusBar.tsx        # Enhanced with sync status display
```

## Usage Examples

### 1. Basic Offline-First Operations

```typescript
import { safeSetDoc, safeUpdateDoc, safeDeleteDoc } from '../lib/safeFirestoreOps';

// Set document (auto-queues if offline)
const result = await safeSetDoc('requests', 'req123', {
  title: 'Cargo Request',
  status: 'open',
});

if (result.success) {
  if (result.fromCache) {
    console.log('✅ Queued for sync when online');
  } else {
    console.log('✅ Saved to Firestore');
  }
}

// Update document
await safeUpdateDoc('requests', 'req123', {
  status: 'pending',
});

// Delete document
await safeDeleteDoc('requests', 'req123');
```

### 2. Safe Queries (Work Offline)

```typescript
import { safeQuery } from '../lib/safeFirestoreOps';
import { where, orderBy } from 'firebase/firestore';

// Query always works, returns cached data when offline
const result = await safeQuery('requests', [
  where('status', '==', 'open'),
  orderBy('createdAt', 'desc'),
]);

if (result.fromCache) {
  console.log('📖 Results from local cache');
} else {
  console.log('📖 Results from Firestore');
}

const documents = result.documents;
```

### 3. Monitor Sync Status

```typescript
import { useSyncStatus } from '../hooks/useSyncStatus';

export function MyComponent() {
  const { 
    isSyncing, 
    pendingCount, 
    syncStatus,
    lastError,
    syncNow 
  } = useSyncStatus();

  return (
    <>
      {syncStatus === 'pending' && (
        <button onClick={syncNow}>
          Sync {pendingCount} pending changes
        </button>
      )}

      {lastError && (
        <ErrorMessage>{lastError.message}</ErrorMessage>
      )}
    </>
  );
}
```

### 4. Batch Operations

```typescript
import { safeBatchWrite } from '../lib/safeFirestoreOps';

const result = await safeBatchWrite([
  {
    type: 'set',
    collection: 'requests',
    id: 'req1',
    data: { title: 'Cargo 1' },
  },
  {
    type: 'update',
    collection: 'requests',
    id: 'req2',
    data: { status: 'accepted' },
  },
  {
    type: 'delete',
    collection: 'requests',
    id: 'req3',
  },
]);

if (result.queued) {
  console.log(`✅ ${result.queued} operations queued for sync`);
}
```

### 5. Check Pending Operations

```typescript
import { 
  getPendingOfflineOperations, 
  getOfflineQueueStats 
} from '../lib/offlineSync';

// Get all pending operations
const pending = getPendingOfflineOperations();
console.log('Pending operations:', pending);

// Get statistics
const stats = getOfflineQueueStats();
console.log('Queue stats:', {
  total: stats.totalItems,
  creates: stats.byOperation.create,
  updates: stats.byOperation.update,
  deletes: stats.byOperation.delete,
  oldest: stats.oldestItem?.timestamp,
});
```

## How It Works

### 1. Firestore Persistence Initialization

When the app starts, Firestore persistence is automatically enabled:

**React Native**:
- Persistence is enabled automatically by the SDK

### 2. Offline Operation Queuing

When a Firestore write fails due to connectivity issues:

1. Operation is caught and analyzed
2. If it's an offline error, operation is queued locally
3. Queue item stores: collection, operation type, data, timestamp
4. User continues working with local data

### 3. Automatic Syncing

When connection is restored:

1. `useSyncStatus` hook detects connection change
2. Triggers `syncOfflineQueue()`
3. All queued operations are applied to Firestore
4. Each operation retried up to 3 times if it fails
5. Failed items removed after max retries
6. UI updates to show sync progress

### 4. Network Status Display

The `NetworkStatusBar` component shows:

- **Online** → No banner shown
- **Offline** → Red banner: "No internet connection - Data will sync when online"
- **Syncing** → Blue banner: "Syncing X operation(s)..."
- **Pending** → Blue banner: "X pending update(s)"

## Advanced Configuration

### Custom Sync Strategy

```typescript
import { syncOfflineQueue } from '../lib/offlineSync';

// Manual sync with error handling
const result = await syncOfflineQueue();

console.log({
  synced: result.synced,      // Successfully synced operations
  failed: result.failed,      // Failed operations
  errors: result.errors,      // Detailed error list
});
```

### Offline Queue Statistics

```typescript
import { getOfflineQueueStats } from '../lib/offlineSync';

const stats = getOfflineQueueStats();

// Response:
{
  totalItems: 5,
  byOperation: {
    create: 2,
    update: 2,
    delete: 1,
  },
  oldestItem: { /* oldest queued operation */ },
  newestItem: { /* newest queued operation */ },
}
```

### Enable Offline Sync Listener

```typescript
import { initializeOfflineSync } from '../lib/offlineSync';

// Call in app initialization
initializeOfflineSync();

// Now online/offline events automatically trigger sync
```

## Data Flow

```
User Action (Create/Update/Delete)
         ↓
    Try Firestore Write
         ↓
    ┌─────────────────┐
    │  Connected?     │
    └─────────────────┘
         ↙         ↘
       YES          NO
         ↓           ↓
   Write OK     Queue Offline
         ↓           ↓
    Update UI   Update UI (cached)
         ↓           ↓
    Show ✅      Show ⏱️ pending
         ↓
   Connection Restored
         ↓
   Auto-Sync Queue
         ↓
   Retry Failed Ops
         ↓
   Update Cloud Data
         ↓
    Show ✅ synced
```

## Error Handling

### Operation Failure Recovery

```typescript
const result = await safeSetDoc('collection', 'docId', data);

if (!result.success) {
  // Offline error → automatically queued
  if (result.fromCache) {
    console.log('Queued for later sync');
  } else {
    // Real error → handle manually
    console.error('Error:', result.error);
  }
}
```

### Sync Error Recovery

```typescript
const { lastError, syncNow } = useSyncStatus();

if (lastError) {
  console.log('Sync failed:', lastError.message);
  
  // Manually retry
  await syncNow();
}
```

## Performance Considerations

### Online Mode
- ✅ Normal Firestore latency (minimal overhead)
- ✅ All operations go directly to cloud

### Offline Mode
- ✅ Instant writes (queued locally)
- ✅ Instant reads (from cache)
- ✅ Zero cloud operations until sync

### Sync Mode
- ✅ Batch operations for efficiency
- ✅ Exponential backoff prevents server overload
- ✅ Max 3 retries per operation

## Limitations

1. **Storage Size**: Depends on device/platform limits
2. **Offline Additions**: Documents with temporary IDs until synced
3. **Conflict Resolution**: Last-write-wins strategy (no merge logic)
4. **Complex Queries**: Some advanced queries may not work offline

## Best Practices

1. **Use Safe Operations**: Always use `safe*` functions from `safeFirestoreOps`
2. **Handle Offline UI**: Show visual indicators for pending sync
3. **Batch Operations**: Group multiple writes in `safeBatchWrite`
4. **Monitor Sync**: Use `useSyncStatus` to track sync progress
5. **Test Offline**: Debug with DevTools offline mode
6. **Error Handling**: Always check `result.success` and `result.error`

## Testing Offline Mode

### In React Native
1. Toggle WiFi/Mobile data off
2. App queues operations
3. Enable connectivity
4. Sync triggers automatically

## Monitoring

### Console Logs

```typescript
// Initialization
✅ Firestore offline persistence enabled (React Native - automatic)

// Queuing
📤 Offline operation queued: update in requests {documentId: "req123"}

// Syncing
🔄 Starting offline queue sync (3 items)...
✅ Offline queue synced: 3 succeeded, 0 failed
```

### UI Indicators

- **Red Banner**: Connection lost
- **Blue Banner**: Pending/Syncing operations
- **Sync Button**: Manual retry in settings

## Troubleshooting

### Persistence Not Working

**Symptom**: App loses data when offline

**Solution**:
```typescript
// Check if persistence is enabled
import { getOfflineQueueStats } from '../lib/offlineSync';
console.log(getOfflineQueueStats());

// Force re-enable
import { initializeOfflineSync } from '../lib/offlineSync';
initializeOfflineSync();
```

### Sync Stuck

**Symptom**: Operations not syncing after reconnect

**Solution**:
```typescript
// Manual sync
const { syncNow } = useSyncStatus();
await syncNow();

// Check queue
const pending = getPendingOfflineOperations();
console.log('Pending:', pending);
```

### Data Not Updating

**Symptom**: Changes not appearing in UI

**Solution**:
```typescript
// Check from cache flag
const result = await safeQuery('collection', []);
console.log('From cache?', result.fromCache);

// Force refresh from server by turning off offline mode
```

## Summary

The offline-first architecture provides:

✅ **Transparent**: Users never know about network issues  
✅ **Automatic**: Sync happens without user action  
✅ **Reliable**: Exponential backoff and retry logic  
✅ **Observable**: UI shows sync status always  
✅ **Simple**: Use `safe*` functions for automatic handling  

This makes the TruckinFox app work reliably in any network condition!
