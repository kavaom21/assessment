CREATE TABLE IF NOT EXISTS orders (
  order_id      TEXT PRIMARY KEY,
  customer_id   TEXT NOT NULL,
  order_date    TIMESTAMPTZ NOT NULL,
  order_amount  NUMERIC(12,2) NOT NULL CHECK (order_amount >= 0),
  status        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);