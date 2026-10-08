-- =====================================================================
-- AgentDB collector schema
--
-- Two parts:
--   1. agentdb_* tables — owned by the collector/agent (metrics, events,
--      per-query samples). These are NOT PostgreSQL catalogue tables.
--   2. an application schema (customers / products / orders / order_items)
--      that acts as the optimisation target. It is deliberately missing two
--      indexes so the index detector has something real to find.
--
-- Safe to run repeatedly: everything is IF NOT EXISTS and the seed only runs
-- when the tables are empty.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. AgentDB internal tables
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agentdb_metrics (
    collected_at     timestamptz PRIMARY KEY DEFAULT now(),
    tps              double precision,
    qps              double precision,
    mean_latency_ms  double precision,
    cpu_percent      double precision,
    memory_percent   double precision,
    active_connections integer,
    cache_hit_ratio  double precision
);

CREATE TABLE IF NOT EXISTS agentdb_query_samples (
    collected_at    timestamptz NOT NULL DEFAULT now(),
    queryid         text        NOT NULL,
    mean_exec_time  double precision NOT NULL,
    PRIMARY KEY (collected_at, queryid)
);

-- The table may predate the DEFAULT; make it idempotent.
ALTER TABLE agentdb_query_samples ALTER COLUMN collected_at SET DEFAULT now();

CREATE TABLE IF NOT EXISTS agentdb_events (
    id             bigserial PRIMARY KEY,
    timestamp      timestamptz NOT NULL DEFAULT now(),
    type           text NOT NULL,
    level          text NOT NULL,
    message        text NOT NULL,
    detail         text,
    actor          text NOT NULL DEFAULT 'agent',
    related_id     text,
    related_label  text
);

CREATE INDEX IF NOT EXISTS agentdb_events_ts_idx ON agentdb_events (timestamp DESC);

-- ---------------------------------------------------------------------
-- 2. Application schema (optimisation target)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email       varchar(255) NOT NULL,
    name        varchar(120) NOT NULL,
    segment     varchar(32)  NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_key ON customers (email);

CREATE TABLE IF NOT EXISTS products (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku       varchar(64)  NOT NULL,
    name      varchar(200) NOT NULL,
    category  varchar(64)  NOT NULL,
    price     numeric(10,2) NOT NULL,
    stock     integer       NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON products (sku);
CREATE INDEX IF NOT EXISTS products_category_price_idx ON products (category, price);

CREATE TABLE IF NOT EXISTS orders (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id    bigint        NOT NULL,   -- intentionally NOT indexed
    status         varchar(24)   NOT NULL,
    total_amount   numeric(12,2) NOT NULL,
    reference_code varchar(32),
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now()
);
-- Deliberately no index on customer_id: this is the missing index the
-- detector should propose.
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
-- A legacy index that nothing queries, to demonstrate unused-index detection.
CREATE INDEX IF NOT EXISTS orders_reference_code_idx ON orders (reference_code);

CREATE TABLE IF NOT EXISTS order_items (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id    bigint NOT NULL,
    product_id  bigint NOT NULL,             -- intentionally NOT indexed
    quantity    integer NOT NULL,
    unit_price  numeric(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

-- ---------------------------------------------------------------------
-- 3. Seed (only when empty)
-- ---------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM customers LIMIT 1) THEN
        INSERT INTO customers (email, name, segment, created_at)
        SELECT 'user' || i || '@example.com',
               'Customer ' || i,
               (ARRAY['enterprise','smb','consumer','partner'])[1 + (i % 4)],
               now() - ((i % 720) || ' days')::interval
        FROM generate_series(1, 50000) AS i;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products LIMIT 1) THEN
        INSERT INTO products (sku, name, category, price, stock)
        SELECT 'SKU-' || lpad(i::text, 7, '0'),
               'Product ' || i,
               (ARRAY['electronics','home','outdoors','toys','grocery','apparel'])[1 + (i % 6)],
               round((5 + (i % 495) + (i % 100) / 100.0)::numeric, 2),
               (i * 7919) % 500
        FROM generate_series(1, 120000) AS i;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM orders LIMIT 1) THEN
        INSERT INTO orders (customer_id, status, total_amount, reference_code, created_at, updated_at)
        SELECT 1 + ((i * 2654435761) % 50000),
               (ARRAY['pending','paid','shipped','delivered','cancelled'])[1 + (i % 5)],
               round((10 + (i % 500) + (i % 97) / 100.0)::numeric, 2),
               'REF-' || lpad((i % 5000)::text, 6, '0'),
               now() - ((i % 365) || ' days')::interval,
               now() - ((i % 30) || ' days')::interval
        FROM generate_series(1, 1000000) AS i;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM order_items LIMIT 1) THEN
        -- i is cast to bigint because i * 40503 overflows int4 at ~53,000.
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        SELECT 1 + ((i::bigint * 40503) % 1000000),
               1 + ((i::bigint * 2654435761) % 120000),
               1 + (i % 6),
               round((5 + (i % 200))::numeric, 2)
        FROM generate_series(1, 2000000) AS i;
    END IF;
END $$;

-- Refresh planner statistics so estimates are realistic from the first query.
ANALYZE customers;
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
