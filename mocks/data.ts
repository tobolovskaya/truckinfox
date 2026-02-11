export const mockUsers = [
  {
    id: 'user1',
    email: 'customer@truckinfox.com',
    displayName: 'John Customer',
    role: 'customer',
    verified: true,
    rating: 4.8,
    reviewCount: 25,
  },
  {
    id: 'user2',
    email: 'carrier@truckinfox.com',
    displayName: 'Transport AS',
    role: 'carrier',
    verified: true,
    rating: 4.9,
    reviewCount: 150,
    companyName: 'Transport AS',
    organizationNumber: '123456789',
  },
];

export const mockCargoRequests = [
  {
    id: 'req1',
    customerId: 'user1',
    pickup: 'Oslo, Norway',
    delivery: 'Bergen, Norway',
    cargoType: 'Furniture',
    weight: 500,
    pickupDate: new Date('2024-03-15'),
    deliveryDate: new Date('2024-03-16'),
    description: 'Moving furniture from apartment to new house.',
    status: 'open',
    bidCount: 3,
  },
  {
    id: 'req2',
    customerId: 'user1',
    pickup: 'Trondheim, Norway',
    delivery: 'Stavanger, Norway',
    cargoType: 'Electronics',
    weight: 150,
    pickupDate: new Date('2024-03-18'),
    deliveryDate: new Date('2024-03-19'),
    description: 'Electronic equipment for office relocation.',
    status: 'open',
    bidCount: 5,
  },
];

export const mockBids = [
  {
    id: 'bid1',
    requestId: 'req1',
    carrierId: 'user2',
    amount: 5000,
    estimatedTime: '5 hours',
    message: 'I can handle this delivery with care.',
    status: 'pending',
    createdAt: new Date(),
  },
];

export const mockMessages = [
  {
    id: 'msg1',
    chatId: 'chat1',
    senderId: 'user1',
    receiverId: 'user2',
    text: 'Hi, are you available tomorrow?',
    createdAt: new Date(Date.now() - 3600000),
  },
  {
    id: 'msg2',
    chatId: 'chat1',
    senderId: 'user2',
    receiverId: 'user1',
    text: 'Yes, I can pick up in the morning.',
    createdAt: new Date(Date.now() - 3000000),
  },
];
