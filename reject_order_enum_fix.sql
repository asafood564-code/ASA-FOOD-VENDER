-- SQL Migration: Add 'rejected' to sub_order_status enum type
-- Reason: To support the reject_sub_order RPC which transitions sub_orders to 'rejected' status.

ALTER TYPE public.sub_order_status ADD VALUE IF NOT EXISTS 'rejected';
