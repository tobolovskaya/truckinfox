# Chat Messages Migration Guide

## Зміни структури

### ❌ Стара структура (Nested)
```
chats/{chatId}/messages/{messageId}
```

### ✅ Нова структура (Flat)
```
messages/{messageId}
```

## Схема даних

### Message Document

```typescript
{
  id: string,
  chat_id: string,          // "${requestId}_${userId1}_${userId2}" (sorted)
  request_id: string,       // Cargo request ID
  sender_id: string,        // User who sent the message
  receiver_id: string,      // User who receives the message
  content: string,          // Message text
  sender_name: string,      // Sender's display name
  sender_type: string,      // 'customer' | 'carrier'
  created_at: Timestamp,    // When message was created
  delivered_at: Timestamp,  // When message was delivered
  read_at: Timestamp | null, // When message was read (null if unread)
  read: boolean,            // true if message has been read
  delivered: boolean        // true if message has been delivered
}
```

## Firestore Composite Indexes

Додайте наступні indexes в `firestore.indexes.json`:

```json
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "chat_id", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "receiver_id", "order": "ASCENDING" },
    { "fieldPath": "read", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "receiver_id", "order": "ASCENDING" },
    { "fieldPath": "read_at", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "request_id", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "DESCENDING" }
  ]
}
```

## Firestore Security Rules

```javascript
// Messages collection (flat structure)
match /messages/{messageId} {
  allow read: if isAuthenticated() && (
    request.auth.uid == resource.data.sender_id ||
    request.auth.uid == resource.data.receiver_id
  );
  
  allow create: if isAuthenticated() &&
    request.auth.uid == request.resource.data.sender_id;
  
  // Allow receiver to update read and delivered fields only
  allow update: if isAuthenticated() &&
    request.auth.uid == resource.data.receiver_id &&
    request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['read', 'delivered', 'read_at', 'delivered_at']);
}
```

## Розгортання змін

### 1. Оновіть Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 2. Оновіть Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

**⚠️ Важливо:** Створення indexes може зайняти 10-30 хвилин. Перевірте статус на:
https://console.firebase.google.com/project/YOUR_PROJECT/firestore/indexes

### 3. Міграція існуючих даних (опціонально)

Якщо у вас є існуючі повідомлення в старій структурі, створіть Cloud Function для міграції:

```typescript
import * as admin from 'firebase-admin';

export async function migrateMessages() {
  const db = admin.firestore();
  
  // Get all chats
  const chatsSnapshot = await db.collection('chats').get();
  
  for (const chatDoc of chatsSnapshot.docs) {
    const chatId = chatDoc.id;
    
    // Get all messages in this chat
    const messagesSnapshot = await db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .get();
    
    // Copy to new flat structure
    const batch = db.batch();
    
    for (const messageDoc of messagesSnapshot.docs) {
      const messageData = messageDoc.data();
      const newMessageRef = db.collection('messages').doc();
      
      batch.set(newMessageRef, {
        ...messageData,
        chat_id: chatId,
        read: messageData.read_at != null,
        delivered: messageData.delivered_at != null,
      });
    }
    
    await batch.commit();
    console.log(`Migrated ${messagesSnapshot.size} messages from chat ${chatId}`);
  }
}
```

## Переваги нової структури

### ✅ Простота запитів
- Не потрібно знати chat ID для отримання повідомлень
- Можна легко отримати всі непрочитані повідомлення користувача
- Ефективні запити по request_id

### ✅ Кращі індекси
- Composite indexes оптимізовані для типових запитів
- Швидше отримання повідомлень за фільтрами

### ✅ Масштабованість
- Flat структура краща для великої кількості повідомлень
- Легше робити аналітику та reporting

### ✅ Консистентність
- `generateChatId()` гарантує однаковий chat_id незалежно від порядку користувачів
- Сортування user IDs в chat_id запобігає дублюванню чатів

## Тестування

### 1. Відправка повідомлення

```typescript
const chatId = generateChatId(requestId, userId1, userId2);

await addDoc(collection(db, 'messages'), {
  chat_id: chatId,
  request_id: requestId,
  sender_id: currentUserId,
  receiver_id: otherUserId,
  content: 'Test message',
  created_at: serverTimestamp(),
  delivered_at: serverTimestamp(),
  read: false,
  delivered: true,
});
```

### 2. Отримання повідомлень

```typescript
const chatId = generateChatId(requestId, userId1, userId2);

const messagesQuery = query(
  collection(db, 'messages'),
  where('chat_id', '==', chatId),
  orderBy('created_at', 'asc')
);

const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
  const messages = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  console.log('Messages:', messages);
});
```

### 3. Відмітити як прочитане

```typescript
const messagesQuery = query(
  collection(db, 'messages'),
  where('chat_id', '==', chatId),
  where('receiver_id', '==', currentUserId),
  where('read', '==', false)
);

const snapshot = await getDocs(messagesQuery);

const batch = writeBatch(db);
snapshot.docs.forEach(doc => {
  batch.update(doc.ref, {
    read: true,
    read_at: serverTimestamp()
  });
});

await batch.commit();
```

## Troubleshooting

### Помилка: "Missing or insufficient permissions"
- Перевірте що Firestore Rules розгорнуті
- Переконайтесь що користувач автентифікований
- Перевірте що `sender_id` відповідає `request.auth.uid`

### Помилка: "The query requires an index"
- Перейдіть за посиланням в помилці для створення index
- Або розгорніть indexes: `firebase deploy --only firestore:indexes`
- Зачекайте 10-30 хвилин на створення indexes

### Повідомлення не відображаються
- Перевірте що `chat_id` генерується правильно
- Використовуйте `generateChatId()` для консистентності
- Перевірте Firebase Console для перегляду даних

## Підтримка

Для питань та допомоги:
- GitHub Issues: https://github.com/tobolovskaya/truckinfox/issues
- Документація Firestore: https://firebase.google.com/docs/firestore
