export function validateRow(raw) {
  const order_id = String(raw.order_id ?? '').trim();
  const customer_id = String(raw.customer_id ?? '').trim();
  const status = String(raw.status ?? '').trim();
  // PDF typo support: accept order_amount and order_amout
  const amountRaw = String(raw.order_amount ?? raw.order_amout ?? '').trim();
  const dateRaw = String(raw.order_date ?? '').trim();

  if (!order_id) return { error: 'order_id is missing' };
  if (!customer_id) return { error: 'customer_id is missing' };
  if (!status) return { error: 'status is missing' };

  if (amountRaw === '' || !/^\d+(\.\d{1,2})?$/.test(amountRaw)) {
    return { error: `order_amount invalid: "${amountRaw}"` };
  }

  const date = new Date(dateRaw);
  if (dateRaw === '' || Number.isNaN(date.getTime())) {
    return { error: `order_date invalid: "${dateRaw}"` };
  }

  return {
    value: {
      order_id,
      customer_id,
      order_date: date.toISOString(),
      order_amount: amountRaw,
      status,
    },
  };
}
