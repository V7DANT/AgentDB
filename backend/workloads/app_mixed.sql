-- =====================================================================
-- pgbench script: mixed application workload against the app schema.
--
-- Purpose: generate realistic activity on tables that are MISSING an index,
-- so the collector sees sequential scans and the index detector has something
-- to propose.
--
-- Run with something like:
--   pgbench -n -c 4 -j 2 -T 60 -f workloads/app_mixed.sql -d agentdb
-- =====================================================================

\set customer_id random(1, 50000)
\set product_id random(1, 120000)
\set order_id random(1, 1000000)
\set status random(1, 5)

-- 1. Customer order history. customer_id is NOT indexed -> sequential scan.
SELECT id, status, total_amount, created_at
  FROM orders
 WHERE customer_id = :customer_id
 ORDER BY created_at DESC
 LIMIT 20;

-- 2. Product order lines. product_id is NOT indexed -> sequential scan.
SELECT id, order_id, quantity, unit_price
  FROM order_items
 WHERE product_id = :product_id
 LIMIT 50;

-- 3. Status-filtered order lookup (uses orders_status_idx).
SELECT o.id, o.total_amount, c.email
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
 WHERE o.status = CASE :status
                    WHEN 1 THEN 'pending'
                    WHEN 2 THEN 'paid'
                    WHEN 3 THEN 'shipped'
                    WHEN 4 THEN 'delivered'
                    ELSE 'cancelled'
                  END
   AND o.created_at >= now() - interval '90 days'
 LIMIT 100;

-- 4. Revenue rollup over a recent window.
SELECT date_trunc('day', created_at) AS day,
       count(*) AS orders,
       sum(total_amount) AS revenue
  FROM orders
 WHERE created_at >= now() - interval '30 days'
 GROUP BY 1
 ORDER BY 1;

-- 5. Point lookups that do use an index, for contrast.
SELECT id, sku, name, price
  FROM products
 WHERE id = :product_id;

SELECT count(*) AS pending_orders
  FROM orders
 WHERE status = 'pending';
