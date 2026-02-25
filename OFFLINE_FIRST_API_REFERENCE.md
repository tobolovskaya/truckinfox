# Offline-First API Reference

Complete API documentation for the offline-first feature suite.

---

## Table of Contents

1. [safeFirestoreOps.ts](#safefirестoreopstx)
2. [offlineSync.ts](#offlinesyncstx)
3. [hooks/useSyncStatus.ts](#hooksusesyncstatusts)
4. [hooks/useNetworkStatus.ts](#hooksusenetworkstatusts)
5. [lib/firebase.ts](#libfirebasetschanges)

---

## safeFirestoreOps.ts

Safe Firestore operations with automatic offline queuing.

### `safeSetDoc()`

Set or merge document with offline support.

```typescript
async function safeSetDoc(
  collectionName: string,
  documentId: string,
  data: any,
  merge?: boolean
): Promise<SafeDocResult>
```

**Parameters:**
- `collectionName` (string, required): Firestore collection name
- `documentId` (string, required): Document ID
- `data` (any, required): Document data to set
- `merge` (boolean, optional): Merge with existing doc. Default: false

**Returns:**
```typescript
{
  success: boolean;        // Operation succeeded (true = queued if offline)
  fromCache?: boolean;     // true = offline (queued), false = cloud
  error?: string;          // Error message if success = false
}
```

**Behavior:**
- If online: Writes to Firestore with `serverTimestamp()`
- If offline: Queues operation in memory, returns `fromCache: true`
- Automatically syncs when connection restored

**Example:**
```typescript
const result = await safeSetDoc('users', userId, {
  name: 'John Doe',
  email: 'john@example.com',
  updatedAt: serverTimestamp()
});

if (result.success) {
  console.log(result.fromCache ? 'Saved locally' : 'Synced to cloud');
} else {
  console.error('Failed:', result.error);
}
```

---

### `safeUpdateDoc()`

Update document fields with offline support.

```typescript
async function safeUpdateDoc(
  collectionName: string,
  documentId: string,
  data: any
): Promise<SafeDocResult>
```

**Parameters:**
- `collectionName` (string, required): Firestore collection name
- `documentId` (string, required): Document ID
- `data` (any, required): Fields to update

**Returns:**
```typescript
{
  success: boolean;
  fromCache?: boolean;
  error?: string;
}
```

**Behavior:**
- If online: Partial update to Firestore
- If offline: Queues update, merges with local version
- Updates `updatedAt` timestamp automatically
- Only queues if at least one field changes

**Example:**
```typescript
const result = await safeUpdateDoc('requests', requestId, {
  status: 'completed',
  completedAt: serverTimestamp()
});
```

---

### `safeDeleteDoc()`

Delete document with offline support.

```typescript
async function safeDeleteDoc(
  collectionName: string,
  documentId: string
): Promise<SafeDocResult>
```

**Parameters:**
- `collectionName` (string, required): Firestore collection name
- `documentId` (string, required): Document ID

**Returns:**
```typescript
{
  success: boolean;
  fromCache?: boolean;
  error?: string;
}
```

**Behavior:**
- If online: Deletes from Firestore immediately
- If offline: Marks for deletion, removes from local cache
- Queues delete operation to execute when online
- Prevents accessing deleted doc locally

**Example:**
```typescript
const result = await safeDeleteDoc('messages', messageId);

if (result.success) {
  console.log('Deleted successfully');
}
```

---

### `safeGetDoc()`

Read single document with offline cache support.

```typescript
async function safeGetDoc(
  collectionName: string,
  documentId: string
): Promise<SafeGetResult>
```

**Parameters:**
- `collectionName` (string, required): Firestore collection name
- `documentId` (string, required): Document ID

**Returns:**
```typescript
{
  success: boolean;
  data?: any;              // Document data
  exists?: boolean;        // Document exists
  fromCache?: boolean;     // true = from local cache
  error?: string;          // Error message if failed
}
```

**Behavior:**
- If online: Fetches from Firestore, updates cache
- If offline: Returns from local cache
- Returns `data = undefined` if document doesn't exist
- Returns `fromCache: true` when using cached data

**Example:**
```typescript
const result = await safeGetDoc('users', userId);

if (result.success && result.exists) {
  console.log('User data:', result.data);
  if (result.fromCache) {
    console.log('(Data from cache - may be outdated)');
  }
}
```

---

### `safeQuery()`

Query documents with offline cache support.

```typescript
async function safeQuery(
  collectionName: string,
  constraints: QueryConstraint[]
): Promise<SafeQueryResult>
```

**Parameters:**
- `collectionName` (string, required): Firestore collection name
- `constraints` (QueryConstraint[], required): Query constraints from Firebase
  - Use firebase/firestore: `where()`, `orderBy()`, `limit()`, etc.

**Returns:**
```typescript
{
  success: boolean;
  documents?: any[];       // Array of documents
  fromCache?: boolean;     // true = from local cache
  error?: string;
}
```

**Behavior:**
- If online: Executes query against Firestore
- If offline: Queries local cached documents
- Offline queries only search what's been cached
- Includes pending queued operations

**Example:**
```typescript
import { where, orderBy, limit } from 'firebase/firestore';

const result = await safeQuery('requests', [
  where('status', '==', 'open'),
  where('userId', '==', currentUserId),
  orderBy('createdAt', 'desc'),
  limit(10)
]);

if (result.success) {
  console.log(`Found ${result.documents.length} requests`);
  if (result.fromCache) {
    console.log('Results from cache (may be incomplete)');
  }
}
```

---

### `safeAddDoc()`

Add new document with offline support.

```typescript
async function safeAddDoc(
  collectionName: string,
  data: any
): Promise<SafeAddResult>
```

**Parameters:**
- `collectionName` (string, required): Firestore collection name
- `data` (any, required): Document data (ID auto-generated)

**Returns:**
```typescript
{
  success: boolean;
  id?: string;             // Document ID (temporary if offline)
  fromCache?: boolean;     // true = offline (temporary ID)
  error?: string;
}
```

**Behavior:**
- If online: Creates on Firestore (gets real ID)
- If offline: Generates temporary UUID locally
- Returns temporary ID that will update when synced
- Queues operation for when connection restored

**Example:**
```typescript
const result = await safeAddDoc('messages', {
  conversationId: convId,
  text: 'Hello!',
  sender: userId,
  createdAt: serverTimestamp()
});

if (result.success) {
  const messageId = result.id; // Use this ID in UI
  
  // Later, when synced, this ID becomes the real Firestore ID
  if (result.fromCache) {
    console.log('Message ID will update when synced');
  }
}
```

---

### `safeBatchWrite()`

Batch multiple operations with offline support.

```typescript
async function safeBatchWrite(
  operations: BatchOperation[]
): Promise<SafeBatchResult>
```

**Parameters:**
- `operations` (BatchOperation[], required): Array of write operations

**BatchOperation:**
```typescript
{
  type: 'set' | 'update' | 'delete';
  collection: string;       // Firestore collection
  id: string;              // Document ID
  data?: any;              // Data for set/update (not needed for delete)
  merge?: boolean;         // For set operations (optional)
}
```

**Returns:**
```typescript
{
  success: boolean;
  queued?: boolean;        // true = entire batch queued (all or nothing)
  error?: string;
}
```

**Behavior:**
- If online: Executes all operations atomically
- If offline: Queues entire batch as single unit
- Either all operations succeed or all are queued
- Maintains transactional consistency

**Example:**
```typescript
const result = await safeBatchWrite([
  {
    type: 'set',
    collection: 'requests',
    id: requestId,
    data: { status: 'completed', completedAt: serverTimestamp() }
  },
  {
    type: 'update',
    collection: 'users',
    id: userId,
    data: { completedJobs: increment(1) }
  },
  {
    type: 'update',
    collection: 'analytics',
    id: 'daily_stats',
    data: { completionsToday: increment(1) }
  }
]);

if (result.success) {
  console.log(result.queued 
    ? 'Batch queued for sync' 
    : 'Batch executed immediately'
  );
}
```

---

## offlineSync.ts

Offline queue management and sync orchestration.

### `OfflineQueueItem` Interface

Represents a single queued operation.

```typescript
interface OfflineQueueItem {
  id: string;                    // Unique queue item ID (UUID)
  collectionName: string;        // Firestore collection
  operation: 'create' | 'update' | 'delete';
  documentId: string;           // Document ID
  data: any;                    // Document data
  timestamp: number;            // Queue timestamp (milliseconds)
  retries: number;              // Retry count (0-3)
  lastError?: string;           // Last sync error message
}
```

---

### `queueOfflineOperation()`

Add operation to offline queue.

```typescript
async function queueOfflineOperation(
  collectionName: string,
  operation: 'create' | 'update' | 'delete',
  documentId: string,
  data: any
): Promise<string>
```

**Parameters:**
- `collectionName` (string): Firestore collection name
- `operation` ('create'|'update'|'delete'): Operation type
- `documentId` (string): Document ID
- `data` (any): Document data

**Returns:**
- Unique queue item ID (string)

**Behavior:**
- Adds operation to in-memory queue
- Doesn't execute immediately
- Automatically syncs when online
- Max 3 retries per operation

**Example:**
```typescript
const queueId = await queueOfflineOperation(
  'requests',
  'update',
  'request_123',
  { status: 'accepted' }
);

console.log('Queued with ID:', queueId);
```

---

### `syncOfflineQueue()`

Synchronize all queued operations to Firestore.

```typescript
async function syncOfflineQueue(): Promise<SyncResult>
```

**No parameters.**

**Returns:**
```typescript
{
  synced: number;              // Operations successfully synced
  failed: number;              // Operations that still failed
  errors: string[];            // Error messages
}
```

**Behavior:**
- Batch writes all operations to Firestore
- Implements exponential backoff retry
- Max 3 retries per operation (1s, 2s, 4s)
- Removes failed operations after max retries
- Called automatically on reconnect
- Can be manually triggered via `useSyncStatus().syncNow()`

**Example:**
```typescript
const result = await syncOfflineQueue();

console.log(`Synced: ${result.synced}, Failed: ${result.failed}`);

if (result.errors.length > 0) {
  console.error('Sync errors:', result.errors);
}
```

---

### `getPendingOfflineOperations()`

Get all queued operations.

```typescript
function getPendingOfflineOperations(): OfflineQueueItem[]
```

**No parameters.**

**Returns:**
- Array of queued operations

**Behavior:**
- Synchronous function
- Returns copy of queue
- Ordered by timestamp (oldest first)

**Example:**
```typescript
const pending = getPendingOfflineOperations();

console.log(`${pending.length} operations pending`);

pending.forEach(op => {
  console.log(
    `${op.operation} on ${op.collectionName}/${op.documentId} ` +
    `(attempt ${op.retries})`
  );
});
```

---

### `getOfflineQueueStats()`

Get queue statistics.

```typescript
function getOfflineQueueStats(): QueueStats
```

**Returns:**
```typescript
{
  total: number;
  byOperation: {
    create: number;
    update: number;
    delete: number;
  };
  oldestItem?: OfflineQueueItem;
  newestItem?: OfflineQueueItem;
  totalRetries: number;
}
```

**Example:**
```typescript
const stats = getOfflineQueueStats();

console.log(`Queue has ${stats.total} items`);
console.log(`Creates: ${stats.byOperation.create}`);
console.log(`Updates: ${stats.byOperation.update}`);
console.log(`Deletes: ${stats.byOperation.delete}`);
console.log(`Oldest: ${new Date(stats.oldestItem?.timestamp)}`);
```

---

### `initializeOfflineSync()`

Initialize offline sync system (called on app start).

```typescript
function initializeOfflineSync(): void
```

**Called from:** `app/_layout.tsx` on mount

**Behavior:**
- Registers online/offline event listeners
- Automatically syncs when connection restored
- Sets up periodic status polling
- Should be called once per app startup

**Example:**
```typescript
import { initializeOfflineSync } from '../lib/offlineSync';

export default function RootLayout() {
  useEffect(() => {
    // Initialize offline sync on app startup
    initializeOfflineSync();
  }, []);

  return <Stack />;
}
```

---

### `getSyncStatus()`

Get current sync status (snapshot).

```typescript
function getSyncStatus(): SyncStatus
```

**Returns:**
```typescript
{
  isPending: boolean;      // Any operations queued?
  pendingCount: number;    // Number of queued operations
  status: 'synced' | 'pending' | 'syncing';
  isOnline: boolean;       // Connection status
}
```

**Example:**
```typescript
const status = getSyncStatus();

if (status.status === 'pending') {
  console.log(`${status.pendingCount} operations waiting to sync`);
}
```

---

### `clearOfflineQueue()`

Clear all queued operations (destructive).

```typescript
function clearOfflineQueue(): number
```

**Returns:**
- Number of operations cleared

**Warning:** This removes all pending operations permanently. Use cautiously.

**Example:**
```typescript
const cleared = clearOfflineQueue();
console.log(`Cleared ${cleared} operations`);
```

---

## hooks/useSyncStatus.ts

React hook for monitoring offline sync status.

### `useSyncStatus()`

Monitor sync status and control sync.

```typescript
function useSyncStatus(): SyncStatusHook
```

**Returns:**
```typescript
{
  isSyncing: boolean;              // Currently syncing?
  pendingCount: number;            // Queued operations count
  pendingOperations: OfflineQueueItem[];  // Queue details
  syncStatus: 'synced' | 'pending' | 'syncing';
  lastError: Error | null;         // Last sync error
  syncNow: () => Promise<void>;    // Trigger manual sync
}
```

**Behavior:**
- Auto-syncs when connection restored
- Updates pending count every 5 seconds
- Returns immediately (no suspension)
- Safe to call in render
- Manual `syncNow()` only works when online

**Example:**
```typescript
import { useSyncStatus } from '../hooks/useSyncStatus';

export default function MyScreen() {
  const { 
    syncStatus, 
    pendingCount, 
    isSyncing, 
    syncNow 
  } = useSyncStatus();

  return (
    <View>
      {isSyncing && <ActivityIndicator />}
      
      {syncStatus === 'pending' && (
        <View>
          <Text>{pendingCount} changes pending</Text>
          <Button 
            onPress={syncNow}
            title="Sync Now"
          />
        </View>
      )}
      
      {syncStatus === 'synced' && (
        <Text>✅ All changes synced</Text>
      )}
    </View>
  );
}
```

---

## hooks/useNetworkStatus.ts

React hook for monitoring network status.

### `useNetworkStatus()`

Monitor network connectivity.

```typescript
function useNetworkStatus(): NetworkStatus
```

**Returns:**
```typescript
{
  isConnected: boolean;       // Has any network connection
  isInternetReachable: boolean; // Can reach internet
  type: 'wifi' | 'cellular' | 'none' | 'unknown';
  strength: number;           // Signal strength (0-100%)
  isOnline: boolean;          // Same as isConnected (alias)
}
```

**Example:**
```typescript
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function NetworkIndicator() {
  const { isConnected, type, strength } = useNetworkStatus();

  if (!isConnected) {
    return <View style={styles.offline}>No Connection</View>;
  }

  return (
    <View>
      <Text>{type.toUpperCase()} - {strength}%</Text>
    </View>
  );
}
```

---

## lib/firebase.ts Changes

### Offline Persistence Initialization

```typescript
// React Native: Persistence enabled automatically by SDK
// No configuration needed - Firebase React Native SDK
// automatically enables offline persistence
```

---

## Response Type Definitions

### SafeDocResult
```typescript
interface SafeDocResult {
  success: boolean;
  fromCache?: boolean;
  error?: string;
}
```

### SafeGetResult
```typescript
interface SafeGetResult {
  success: boolean;
  data?: any;
  exists?: boolean;
  fromCache?: boolean;
  error?: string;
}
```

### SafeQueryResult
```typescript
interface SafeQueryResult {
  success: boolean;
  documents?: any[];
  fromCache?: boolean;
  error?: string;
}
```

### SafeAddResult
```typescript
interface SafeAddResult {
  success: boolean;
  id?: string;           // Temporary if offline, real ID when synced
  fromCache?: boolean;
  error?: string;
}
```

### SafeBatchResult
```typescript
interface SafeBatchResult {
  success: boolean;
  queued?: boolean;      // true if entire batch was queued
  error?: string;
}
```

### SyncResult
```typescript
interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}
```

### QueueStats
```typescript
interface QueueStats {
  total: number;
  byOperation: {
    create: number;
    update: number;
    delete: number;
  };
  oldestItem?: OfflineQueueItem;
  newestItem?: OfflineQueueItem;
  totalRetries: number;
}
```

### SyncStatus
```typescript
interface SyncStatus {
  isPending: boolean;
  pendingCount: number;
  status: 'synced' | 'pending' | 'syncing';
  isOnline: boolean;
}
```

### SyncStatusHook
```typescript
interface SyncStatusHook {
  isSyncing: boolean;
  pendingCount: number;
  pendingOperations: OfflineQueueItem[];
  syncStatus: 'synced' | 'pending' | 'syncing';
  lastError: Error | null;
  syncNow: () => Promise<void>;
}
```

### NetworkStatus
```typescript
interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: 'wifi' | 'cellular' | 'none' | 'unknown';
  strength: number;
  isOnline: boolean;
}
```

---

## Common Patterns

### Check before proceeding

```typescript
const result = await safeSetDoc('users', userId, Data);

if (!result.success) {
  throw new Error(result.error);
}

// Proceed knowing operation either executed or queued
```

### Show loading state based on sync

```typescript
const { isSyncing, pendingCount } = useSyncStatus();

<ActivityIndicator animating={isSyncing || pendingCount > 0} />
```

### Retry specific operation

```typescript
let attempts = 0;
let result;

while (attempts < 3) {
  result = await safeSetDoc(collection, id, data);
  if (result.success) break;
  attempts++;
  await delay(1000);
}
```

### Batch related operations

```typescript
const result = await safeBatchWrite([
  { type: 'update', collection: 'orders', id: orderId, data: { paid: true } },
  { type: 'update', collection: 'users', id: userId, data: { balance: decrement(amount) } }
]);

// Both sync together or queue together
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `PERMISSION_DENIED` | No Firestore permissions | Check security rules |
| `INVALID_ARGUMENT` | Bad document data | Validate data before save |
| `UNAVAILABLE` | Firestore temporarily down | Operational error, will retry |
| `FAILED_PRECONDITION` | Offline persistence unavailable | Device storage full? |

### Handling Offline Errors

```typescript
try {
  const result = await safeSetDoc(collection, id, data);
  
  if (result.success) {
    // Either synced (fromCache=false) or queued (fromCache=true)
    showStatus(result.fromCache ? 'Saved locally' : 'Synced');
  } else {
    // Operation truly failed (not just offline)
    showError(`Failed: ${result.error}`);
  }
} catch (error) {
  // Unexpected error
  showError(`Error: ${error.message}`);
}
```

---

## Performance Considerations

### Queue Size
- In-memory queue: 1000+ operations default
- Recommended: Keep < 500 for best performance

### Sync Frequency
- Auto-sync: When connection restored
- Manual: User can trigger via `syncNow()`
- Polling: Queue updates every 5 seconds

### Storage
- React Native: Platform specific (iOS: unlimited, Android: varies)
- Data: Compressed JSON with timestamps

### Bandwidth
- Batch sync: All operations in single write
- Retry backoff: 1s, 2s, 4s delays
- Network check: Continuous monitoring

---

## Troubleshooting

### Queue not syncing
1. Check `useSyncStatus().syncStatus`
2. Verify network with `useNetworkStatus()`
3. Check `getPendingOfflineOperations()` for errors
4. See `lastError` in `useSyncStatus()`

### Data inconsistency
1. Read from cache too long
2. Solution: Call `syncNow()` to force sync
3. Or: Wait for auto-sync on reconnect

### Large queue
1. Phone offline for extended period
2. Many writes accumulated
3. Solution: Reduce operation frequency
4. Or: Clear queue if data not important

### Memory issues
1. Extremely large queue (100+ items)
2. Solution: Sync more frequently
3. Or: Clear ancient items with `clearOfflineQueue()`

