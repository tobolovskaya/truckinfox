export async function fetchOrders() {
  return [] as unknown[];
}

export async function createOrder(payload: unknown) {
  return { id: 'order-1', payload };
}
