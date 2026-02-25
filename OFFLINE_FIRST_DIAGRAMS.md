# Offline-First Architecture Diagram

## System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TruckinFox App                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  User Interface Layer (React Components)                     │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  - RequestsScreen        - ProfileEdit                        │   │
│  │  - ChatScreen            - ReviewScreen                      │   │
│  │  - PaymentScreen         - OrdersScreen                      │   │
│  └────┬─────────────────────────────────────────────────────────┘   │
│       │                                                               │
│  ┌────▼─────────────────────────────────────────────────────────┐   │
│  │  Hooks & Context Layer                                        │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐  │   │
│  │  │ useSyncStatus    │  │ useNetworkStatus                 │  │   │
│  │  │ - isSyncing      │  │ - isConnected                    │  │   │
│  │  │ - pendingCount   │  │ - isInternetReachable            │  │   │
│  │  │ - syncStatus     │  │ - type (wifi/cellular)           │  │   │
│  │  │ - syncNow()      │  │ - strength                       │  │   │
│  │  └──────────────────┘  └──────────────────────────────────┘  │   │
│  └────┬─────────────────────────────────────────────────────────┘   │
│       │                                                               │
│  ┌────▼─────────────────────────────────────────────────────────┐   │
│  │  Data Access Layer                                            │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  ┌──────────────────────┐  ┌──────────────────────────────┐  │   │
│  │  │ safeFirestoreOps     │  │ offlineSync                  │  │   │
│  │  │ - safeSetDoc()       │  │ - queueOfflineOperation()    │  │   │
│  │  │ - safeUpdateDoc()    │  │ - syncOfflineQueue()         │  │   │
│  │  │ - safeDeleteDoc()    │  │ - getPendingOperations()     │  │   │
│  │  │ - safeQuery()        │  │ - getOfflineQueueStats()     │  │   │
│  │  │ - safeGetDoc()       │  │ - clearOfflineQueue()        │  │   │
│  │  │ - safeBatchWrite()   │  │ - initializeOfflineSync()    │  │   │
│  │  └──────────────────────┘  └──────────────────────────────┘  │   │
│  └────┬─────────────────────────────────────────────────────────┘   │
│       │                                                               │
│  ┌────▼─────────────────────────────────────────────────────────┐   │
│  │  Local Cache & Queue Layer                                   │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │  In-Memory Offline Queue (Map<string, QueueItem>)      │  │   │
│  │  │  - Stores pending operations                           │  │   │
│  │  │  - Tracks retries & errors                             │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                           │                                    │   │
│  │                           ▼                                    │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │  Local Storage (Persistent Cache)                      │  │   │
│  │  │  - React Native: Native persistence (Automatic)        │  │   │
│  │  │  - Firestore SDK: Auto-managed                         │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └────┬─────────────────────────────────────────────────────────┘   │
│       │                                                               │
└───────┼───────────────────────────────────────────────────────────────┘
        │
      │  Firebase SDK (firestore.ts)
      │  - Native offline persistence (automatic)
        │
        ▼
     ┌──────────────────────────────────────────────┐
     │         Firebase Firestore                   │
     ├──────────────────────────────────────────────┤
     │  ┌──────────────────┐  ┌──────────────────┐  │
     │  │ Collections      │  │ Documents        │  │
     │  │ - requests       │  │ - request#123    │  │
     │  │ - bids           │  │ - bid#456        │  │
     │  │ - chats          │  │ - chat#789       │  │
     │  │ - messages       │  │ - message#999    │  │
     │  │ - payments       │  │ - payment#111    │  │
     │  │ - reviews        │  │ - review#222     │  │
     │  │ - users          │  │ - user#333       │  │
     │  └──────────────────┘  └──────────────────┘  │
     └──────────────────────────────────────────────┘
```

## Operation Flow Diagram

### Scenario 1: Online Write

```
User Input (Create/Edit)
         │
         ▼
    Enter Data
         │
         ▼
   Press Save
         │
         ▼
  safeSetDoc()
         │
         ▼
  Check Network
         │
      ✅ Online
         │
         ▼
  Write to Firestore
  (Direct Cloud Write)
         │
         ▼
  Update Local Cache
         │
         ▼
  Clear from Queue
         │
         ▼
  Show ✅ Saved
         │
         ▼
    UI Updates
```

### Scenario 2: Offline Write

```
User Input (Create/Edit)
         │
         ▼
    Enter Data
         │
         ▼
   Press Save
         │
         ▼
  safeSetDoc()
         │
         ▼
  Check Network
         │
      ❌ Offline
         │
         ▼
  Store in Local Cache
         │
         ▼
  Add to Queue
  (Pending Operation)
         │
         ▼
  Update Local Data
         │
         ▼
 Show ⏱️ Pending
  (Will sync when online)
         │
         ▼
    UI Shows Data
       (Cached)
```

### Scenario 3: Sync on Reconnect

```
Internet Connection Detected
         │
         ▼
  Network Status Changes
  (isConnected = true)
         │
         ▼
  useSyncStatus Hook Fires
         │
         ▼
  syncOfflineQueue()
         │
         ▼
  Get All Pending Ops
  (From in-memory queue)
         │
         ▼
  Create Write Batch
  (Group all ops)
         │
         ▼
  ┌──────────────────────────────┐
  │  For Each Operation:          │
  │  1. Prepare doc reference    │
  │  2. Apply operation          │
  │  3. Add to batch             │
  └──────────────────────────────┘
         │
         ▼
  Submit Batch to Firestore
         │
    ┌────┴─────┐
    │           │
 Success    Failure
    │           │
    ▼           ▼
Remove from   Retry
Queue       (Max 3)
    │           │
    │      ┌────┴─────┐
    │      │           │
    │   Success    Failed
    │      │           │
    │      ▼           ▼
    │   Remove      Remove
    │   from        from
    │   Queue       Queue
    │      │           │
    └──────┴───────────┘
           │
           ▼
   Update UI
   Show ✅ Synced
           │
           ▼
   Clear Pending Badge
           │
           ▼
   Complete
```

## Data State Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│             Document Lifecycle in Offline-First              │
└─────────────────────────────────────────────────────────────┘

Document Created:
① Online Write
   ├─ Exists in Cloud: ✅
   ├─ Exists in Cache: ✅
   └─ Status: Synced

② Offline Write
   ├─ Exists in Cloud: ❌
   ├─ Exists in Cache: ✅
   ├─ Exists in Queue: ✅
   └─ Status: Pending

③ Queued Operation Syncs
   ├─ Write to Cloud: ✅
   ├─ Update Cache: ✅
   ├─ Remove from Queue: ✅
   └─ Status: Synced

Document Modified:
① Online Update
   ├─ Cloud Updated: ✅
   ├─ Cache Updated: ✅
   └─ Status: Synced

② Offline Update
   ├─ Cloud Updated: ❌
   ├─ Cache Updated: ✅
   ├─ Queue Updated: ✅
   └─ Status: Pending

③ Queued Update Syncs
   ├─ Cloud Merged: ✅
   ├─ Cache Synced: ✅
   ├─ Queue Cleared: ✅
   └─ Status: Synced

Document Deleted:
① Online Delete
   ├─ Cloud Deleted: ✅
   ├─ Cache Deleted: ✅
   └─ Status: Deleted

② Offline Delete
   ├─ Cloud Deleted: ❌
   ├─ Cache Marked: 🔴 (tombstone)
   ├─ Queue Added: ✅
   └─ Status: Pending Delete

③ Queued Delete Syncs
   ├─ Cloud Deleted: ✅
   ├─ Cache Removed: ✅
   ├─ Queue Cleared: ✅
   └─ Status: Deleted (Synced)
```

## Network State Diagram

```
        ┌─────────────────────────────────────┐
        │      Network Status Monitor         │
        └──────────────┬──────────────────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ ONLINE   │  │ CELLULAR │  │ OFFLINE  │
    ├──────────┤  ├──────────┤  ├──────────┤
    │ WiFi+Net │  │ 4G/5G+   │  │ No Conn  │
    │ Low Ping │  │ OK Ping  │  │ Timeout  │
    │ Synping  │  │ Queuing  │  │ Queue    │
    └─────┬────┘  └─────┬────┘  └─────┬────┘
          │             │              │
          │    Trigger  │              │
          │    Sync     │              │
          └─────────────┴──────────────┘
                       │
              syncOfflineQueue()
                       │
              💾 Update Firestore
              💾 Update Cache
              💾 Clear Queue
                       │
                    Done
```

## Quality Assurance Flow

```
Offline Operation:
┌──────────────┐
│ safeSetDoc() │
└──────┬───────┘
       │
  ┌────▼─────────────────────────┐
  │ Validation                    │
  ├───────────────────────────────┤
  │ ✓ Collection name valid       │
  │ ✓ Document ID valid           │
  │ ✓ Data serializable           │
  │ ✓ No circular references      │
  └────┬───────────────────────────┘
       │
  ┌────▼─────────────────────────┐
  │ Try Online Write              │
  ├───────────────────────────────┤
  │ SET doc with serverTimestamp  │
  │ UPDATE cache                  │
  │ REMOVE from queue             │
  └────┬───────────────────────────┘
       │
   ❌ Offline?
       │
  ┌────▼─────────────────────────┐
  │ Fallback to Queue             │
  ├───────────────────────────────┤
  │ QUEUE operation               │
  │ UPDATE local cache            │
  │ RETURN success=true,          │
  │        fromCache=true         │
  └───────────────────────────────┘
       │
    Return
       │
   UI Updates
   with Status
```

## Error Recovery Tree

```
                    Sync Fails
                        │
            ┌───────────┼───────────┐
            │           │           │
         Network    Timeout    Auth Error
            │           │           │
            ▼           ▼           ▼
         Retry     Retry Longer  Log Error
            │           │           │
         Attempt 1   Wait 1s        │
         Attempt 2   Wait 2s        │
         Attempt 3   Wait 4s        │
            │           │           │
         Success?   Success?   Retry Limit?
            │           │           │
         Yes: Done   Yes: Done   ▼ Yes
         No: Continue Continue  Remove
                                from
                                Queue
```

---

## Legend

```
✅  = Success/Online/Saved
❌  = Failure/Offline/Error
⏱️  = Pending/Waiting
📖  = Reading/Querying
📤  = Uploading/Sending
💾  = Saving/Storing
🔴  = Marked/Deleted
🌐  = Network/Cloud
📴  = Offline/No Connectivity
🔄  = Syncing/Retrying
```
