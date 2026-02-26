# Offline-First Implementation Examples

This guide shows real code examples for implementing offline-first features in TruckinFox.

## Quick Start Pattern

### Before (Vulnerable to Offline)

```typescript
// ❌ Direct Firestore calls - breaks offline
async function saveRequest(requestData) {
  const docRef = await addDoc(collection(db, 'requests'), {
    ...requestData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ❌ No sync mechanism
async function loadRequests() {
  const snap = await getDocs(collection(db, 'requests'));
  return snap.docs.map(doc => doc.data());
}
```

### After (Offline-Safe)

```typescript
// ✅ Uses safe wrapper - works offline & online
import { safeAddDoc, safeQuery } from '../lib/safeFirestoreOps';

async function saveRequest(requestData) {
  const result = await safeAddDoc('requests', {
    ...requestData,
    createdAt: serverTimestamp(),
  });

  if (result.success) {
    // Result.id is temporary ID if offline
    return result.id;
  } else {
    throw new Error(result.error);
  }
}

// ✅ Automatically reads from cache if offline
async function loadRequests() {
  const result = await safeQuery('requests', []);

  if (result.success) {
    return result.documents; // Cached or fresh from cloud
  } else {
    throw new Error(result.error);
  }
}
```

---

## Real-World Examples

### Example 1: Create Transport Request

**File**: `app/request-details/create.tsx`

```typescript
import { useState } from 'react';
import { safeAddDoc } from '../../lib/safeFirestoreOps';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import Toast from '../../components/Toast';

export default function CreateRequestScreen() {
  const { user } = useCurrentUser();
  const { syncStatus, pendingCount } = useSyncStatus();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    pickupLocation: {},
    dropoffLocation: {},
    cargoType: '',
    weight: '',
  });

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // ✅ Safe add with auto offline queue
      const result = await safeAddDoc('requests', {
        ...formData,
        userId: user.id,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (result.success) {
        // ✅ Shows different message based on sync status
        if (result.fromCache) {
          Toast.success('📴 Request saved locally. Will sync when online.');
        } else {
          Toast.success('✅ Request created successfully');
        }

        // Navigate back
        router.back();
      }
    } catch (error) {
      Toast.error(`Failed to create request: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      {/* Form fields... */}

      {/* ✅ Show sync status */}
      {syncStatus === 'pending' && (
        <View style={styles.syncAlert}>
          <Text>⏱️ {pendingCount} pending change(s)</Text>
        </View>
      )}

      <Button onPress={handleSubmit} disabled={loading}>
        {loading ? 'Saving...' : 'Create Request'}
      </Button>
    </View>
  );
}
```

### Example 2: Update Bid Status

**File**: `app/request-details/[id]/bids.tsx`

```typescript
import { safeUpdateDoc } from '../../../lib/safeFirestoreOps';
import { useSyncStatus } from '../../../hooks/useSyncStatus';

export async function acceptBid(requestId: string, bidId: string) {
  try {
    // ✅ Safe update with automatic queue fallback
    const result = await safeUpdateDoc('bids', bidId, {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      acceptedBy: currentUserId,
    });

    if (result.success) {
      // ✅ Update request status too
      await safeUpdateDoc('requests', requestId, {
        status: 'bidAccepted',
        acceptedBidId: bidId,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        synced: !result.fromCache, // Did it sync immediately?
        message: result.fromCache
          ? 'Bid accepted locally. Will sync when online.'
          : 'Bid accepted successfully',
      };
    }
  } catch (error) {
    // Fallback queued automatically
    return {
      success: false,
      error: error.message,
    };
  }
}

// In component:
function BidCard({ bid, requestId }) {
  const { pendingCount } = useSyncStatus();
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    const result = await acceptBid(requestId, bid.id);

    if (result.success) {
      Toast.success(result.message);
    } else {
      Toast.error(result.error);
    }

    setAccepting(false);
  };

  return (
    <Card>
      <Text>{bid.companyName}</Text>
      <Text>{bid.price} NOK</Text>

      {/* Show pending indicator */}
      {pendingCount > 0 && <Badge>⏱️ {pendingCount} pending</Badge>}

      <Button onPress={handleAccept} disabled={accepting || bid.status === 'accepted'}>
        {accepting ? 'Accepting...' : 'Accept Bid'}
      </Button>
    </Card>
  );
}
```

### Example 3: Send Chat Message

**File**: `app/chat/[conversationId].tsx`

```typescript
import { safeAddDoc } from '../../lib/safeFirestoreOps';
import { useSyncStatus } from '../../hooks/useSyncStatus';

export default function ChatScreen({ conversationId }) {
  const { syncStatus, pendingCount, syncNow } = useSyncStatus();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const messageData = {
      conversationId,
      senderId: currentUser.id,
      text: inputText.trim(),
      createdAt: serverTimestamp(),
      status: 'pending', // Track message status
    };

    try {
      setSending(true);

      // ✅ Add to messages collection with offline queue
      const result = await safeAddDoc('messages', messageData);

      if (result.success) {
        // ✅ Update UI immediately with temporary ID if offline
        const tempMessage = {
          id: result.id,
          ...messageData,
          _fromCache: result.fromCache, // Mark as pending
        };

        setMessages([...messages, tempMessage]);
        setInputText('');

        // ✅ If offline, show helper text
        if (result.fromCache) {
          Toast.info('💾 Message saved locally');
        }
      }
    } catch (error) {
      Toast.error(`Failed to send: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Messages list */}
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            pending={item._fromCache} // Dim/gray out pending messages
          />
        )}
      />

      {/* Sync status bar */}
      {syncStatus === 'syncing' && (
        <View style={styles.syncingBar}>
          <ActivityIndicator />
          <Text>Syncing messages...</Text>
        </View>
      )}

      {syncStatus === 'pending' && (
        <View style={styles.pendingBar}>
          <Text>⏱️ {pendingCount} messages waiting to send</Text>
          <Button onPress={syncNow}>Sync Now</Button>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type message..."
          editable={!sending}
        />
        <Button onPress={sendMessage} disabled={sending || !inputText.trim()}>
          {sending ? '⏳' : '📤'}
        </Button>
      </View>
    </View>
  );
}
```

### Example 4: Batch Payment Processing

**File**: `app/payment/checkout.tsx`

```typescript
import { safeBatchWrite, safeGetDoc } from '../../lib/safeFirestoreOps';
import { useSyncStatus } from '../../hooks/useSyncStatus';

export async function processPaymentWithOfflineSupport(
  orderId: string,
  paymentAmount: number,
  paymentMethod: string
) {
  try {
    // ✅ Batch multiple related operations
    // They all sync together or queue together
    const result = await safeBatchWrite([
      {
        type: 'set',
        collection: 'payments',
        id: `payment_${orderId}_${Date.now()}`,
        data: {
          orderId,
          amount: paymentAmount,
          method: paymentMethod,
          status: 'processing',
          createdAt: serverTimestamp(),
          processedAt: null,
        },
      },
      {
        type: 'update',
        collection: 'orders',
        id: orderId,
        data: {
          paymentStatus: 'processing',
          lastPaymentAttempt: serverTimestamp(),
        },
      },
      {
        type: 'update',
        collection: 'users',
        id: currentUser.id,
        data: {
          lastPaymentDate: serverTimestamp(),
          totalSpent: increment(paymentAmount),
        },
      },
    ]);

    if (result.success) {
      return {
        success: true,
        queued: result.queued, // true if offline
        message: result.queued ? 'Payment queued. Will process when online.' : 'Payment processing',
      };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// In component:
function CheckoutScreen() {
  const { syncStatus, pendingCount } = useSyncStatus();
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    setProcessing(true);
    const result = await processPaymentWithOfflineSupport(orderId, amount, 'card');

    if (result.success) {
      Toast.success(result.message);
      if (result.queued) {
        // Show helpful message
        showOfflinePaymentInfo();
      }
    } else {
      Toast.error(`Payment failed: ${result.error}`);
    }
    setProcessing(false);
  };

  return (
    <View>
      {/* Checkout form */}

      {/* Show pending transactions */}
      {syncStatus === 'pending' && (
        <Alert
          title="Pending Transactions"
          message={`${pendingCount} transaction(s) waiting to sync`}
          buttons={[
            { text: 'OK', onPress: () => {} },
            { text: 'Sync Now', onPress: syncNow },
          ]}
        />
      )}

      <Button onPress={handlePayment} disabled={processing}>
        {processing ? 'Processing...' : 'Complete Payment'}
      </Button>
    </View>
  );
}
```

### Example 5: Upload Profile with Image

**File**: `app/profile/edit.tsx`

```typescript
import { safeSetDoc, safeAddDoc } from '../../lib/safeFirestoreOps';
import { uploadImageWithRetry } from '../../utils/storage';
import { useSyncStatus } from '../../hooks/useSyncStatus';

export async function updateProfileWithImage(
  userId: string,
  profileData: any,
  imageUri: string | null
) {
  try {
    let imageUrl = profileData.imageUrl;

    // ✅ Upload image if provided
    if (imageUri) {
      imageUrl = await uploadImageWithRetry(
        `profiles/${userId}/avatar.jpg`,
        imageUri,
        3 // 3 retries on failure
      );
    }

    // ✅ Safe update with offline queue
    // Even while image is uploading, profile update queues if offline
    const result = await safeSetDoc(
      'users',
      userId,
      {
        ...profileData,
        imageUrl,
        updatedAt: serverTimestamp(),
        lastEditedBy: 'mobile',
      },
      { merge: true }
    ); // merge: true doesn't overwrite entire doc

    return {
      success: result.success,
      synced: !result.fromCache,
      message: result.fromCache ? 'Profile saved locally. Syncing...' : 'Profile updated',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// In component:
export default function EditProfileScreen() {
  const { syncStatus } = useSyncStatus();
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfileWithImage(user.id, profileData, selectedImage);

    if (result.success) {
      Toast.success(result.message);
      if (!result.synced) {
        // Show syncing indicator
      }
    } else {
      Toast.error(`Failed: ${result.error}`);
    }
    setSaving(false);
  };

  return (
    <View>
      {/* Form fields */}

      {/* Show upload progress with sync info */}
      <View style={styles.statusSection}>
        {syncStatus === 'syncing' && (
          <LottieView source={require('../../assets/syncing.json')} autoPlay />
        )}
        {syncStatus === 'pending' && (
          <Text style={styles.pendingText}>⏱️ Your changes are pending sync</Text>
        )}
      </View>

      <Button
        onPress={handleSave}
        disabled={saving}
        title={saving ? 'Saving...' : 'Save Profile'}
      />
    </View>
  );
}
```

---

## Migration Guide: Converting Existing Features

### Step 1: Identify Direct Firestore Calls

Find all instances in your component/hook where you use Firebase directly:

```typescript
// ❌ Search for patterns like:
import { addDoc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';

// Then usage:
await addDoc(collection(db, 'yourCollection'), data);
await updateDoc(doc(db, 'yourCollection', id), data);
await deleteDoc(doc(db, 'yourCollection', id));
const snap = await getDocs(query(collection(db, 'yourCollection'), where(...)));
```

### Step 2: Replace with Safe Wrappers

```typescript
// ✅ Replace with:
import {
  safeAddDoc,
  safeUpdateDoc,
  safeDeleteDoc,
  safeQuery
} from '../lib/safeFirestoreOps';

// Then usage:
const result = await safeAddDoc('yourCollection', data);
const result = await safeUpdateDoc('yourCollection', id, data);
const result = await safeDeleteDoc('yourCollection', id);
const result = await safeQuery('yourCollection', [where(...)]);
```

### Step 3: Add Offline-Aware UI

```typescript
// Add sync status monitoring
import { useSyncStatus } from '../hooks/useSyncStatus';

export function YourComponent() {
  const { syncStatus, pendingCount } = useSyncStatus();

  return (
    <View>
      {/* Your component UI */}

      {/* Add sync indicator */}
      {syncStatus === 'pending' && <Badge>⏱️ {pendingCount} pending</Badge>}
    </View>
  );
}
```

### Step 4: Handle Offline Responses

```typescript
// ✅ Check if data came from cache
const result = await safeGetDoc('users', userId);

if (result.success) {
  const userData = result.data;
  const isCached = result.fromCache;

  // Show different UI if from cache
  if (isCached) {
    showCachedDataNotice();
  }
}
```

---

## Testing Offline Features

### Simulate Offline Mode

```typescript
// In your test file
import { stopOfflineSync, startOfflineSync } from '../lib/offlineSync';

describe('Offline Features', () => {
  beforeEach(() => {
    stopOfflineSync(); // Disable sync for testing
  });

  afterEach(() => {
    startOfflineSync(); // Re-enable sync
  });

  test('should queue operation when offline', async () => {
    // Simulate offline
    mockNetworkStatus.isConnected = false;

    const result = await safeAddDoc('requests', testData);

    expect(result.success).toBe(true);
    expect(result.fromCache).toBe(true);
  });

  test('should sync when reconnected', async () => {
    // Start offline
    mockNetworkStatus.isConnected = false;
    await safeAddDoc('requests', testData);

    // Come online
    mockNetworkStatus.isConnected = true;

    // Trigger sync
    await syncOfflineQueue();

    // Check cloud write succeeded
    const cloudDoc = await getDoc(doc(db, 'requests', expectedId));
    expect(cloudDoc.exists()).toBe(true);
  });
});
```

### Manual Testing Checklist

- [ ] Create/Edit/Delete content while offline
- [ ] Verify data appears in app (from cache)
- [ ] Go online
- [ ] Verify NetworkStatusBar shows "Syncing..."
- [ ] Verify data syncs to cloud
- [ ] Verify NetworkStatusBar shows synced (disappears)
- [ ] Force app quit while offline after making changes
- [ ] Reopen app
- [ ] Verify changes still there
- [ ] Verify sync happens automatically

---

## Common Patterns

### Pattern 1: Confirm Before Delete (Offline-Safe)

```typescript
async function deleteWithConfirmation(collectionName, docId) {
  const confirmed = await showConfirmDialog('Delete this item?', 'This action cannot be undone.');

  if (confirmed) {
    const result = await safeDeleteDoc(collectionName, docId);

    if (result.success) {
      Toast.success(
        result.fromCache ? 'Deleted. Changes will sync when online.' : 'Deleted successfully'
      );
    }
  }
}
```

### Pattern 2: Optimistic Updates (Offline-Safe)

```typescript
async function optimisticUpdate(collectionName, docId, newData) {
  // Update UI immediately
  setLocalData(newData);

  // Update in background
  const result = await safeUpdateDoc(collectionName, docId, newData);

  if (result.success) {
    // Keep UI as is (already updated)
    Toast.info(result.fromCache ? 'Saving...' : 'Saved');
  } else {
    // Revert UI on failure
    setLocalData(oldData);
    Toast.error('Failed to save changes');
  }
}
```

### Pattern 3: Conditional Sync Trigger

```typescript
function SyncAwareComponent() {
  const { syncStatus, pendingCount, syncNow } = useSyncStatus();

  // Auto-sync on critical conditions
  useEffect(() => {
    if (pendingCount > 10) {
      // Too many pending, sync immediately
      syncNow();
    }
  }, [pendingCount]);

  return (
    <View>
      {pendingCount > 5 && (
        <WarningBanner
          message={`${pendingCount} changes pending!`}
          action={{ label: 'Sync Now', onPress: syncNow }}
        />
      )}
    </View>
  );
}
```

---

## Debugging Tips

### Check Queue Status

```typescript
import { getPendingOfflineOperations, getOfflineQueueStats } from '../lib/offlineSync';

// In DevTools or console:
const operations = getPendingOfflineOperations();
console.log('Pending operations:', operations);

const stats = getOfflineQueueStats();
console.log('Queue stats:', stats);
```

### Monitor Sync Progress

```typescript
import { useSyncStatus } from '../hooks/useSyncStatus';

function DebugSyncStatus() {
  const { syncStatus, pendingCount, isSyncing, lastError } = useSyncStatus();

  return (
    <View style={styles.debugBox}>
      <Text>Status: {syncStatus}</Text>
      <Text>Pending: {pendingCount}</Text>
      <Text>Syncing: {isSyncing ? 'Yes' : 'No'}</Text>
      <Text>Last Error: {lastError?.message}</Text>
    </View>
  );
}
```

### Check Network Status

```typescript
import { useNetworkStatus } from '../hooks/useNetworkStatus';

function DebugNetwork() {
  const { isConnected, type, strength } = useNetworkStatus();

  return (
    <View>
      <Text>Connected: {isConnected ? 'Yes' : 'No'}</Text>
      <Text>Type: {type}</Text>
      <Text>Strength: {strength}%</Text>
    </View>
  );
}
```

---

## Best Practices

1. **Always use safe wrappers** for data operations
2. **Handle `fromCache` responses** - show appropriate UI
3. **Provide sync status feedback** to users
4. **Test offline scenarios** before deploy
5. **Monitor queue size** - don't let it grow unbounded
6. **Use batch writes** for related operations
7. **Add error messages** for failed syncs
8. **Clear queue periodically** to prevent stale data
9. **Document async boundaries** where offline handling changes behavior
10. **Show pending indicators** clearly in UI
