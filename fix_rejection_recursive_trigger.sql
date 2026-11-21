-- SQL Migration: Fix recursive trigger conflict on order rejection
-- Reason: When a sub-order is rejected, it cancels the parent order. The parent order's trigger (sync_completed_order_sub_orders)
-- propagates the cancellation to all sub-orders. By setting a transaction-local session variable 'app.current_updating_sub_order_id',
-- we can identify the sub-order that triggered the cascade and exclude it from the parent order update, preventing a locking conflict.

-- 1. Update handle_sub_order_refund to set the transaction-local session variable
CREATE OR REPLACE FUNCTION public.handle_sub_order_refund()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_customer_id text;
    v_payment_status text;
    v_payment_method text;
    v_total_price numeric;
    v_total_food_price numeric;
    v_gst_amount numeric;
    v_packaging_charge numeric;
    v_platform_fee numeric;
    v_discount numeric;
    v_rounding_adjustment numeric;
    v_remaining_active_sub_orders int;
    v_refunded_so_far numeric;
    v_ratio numeric := 0;
    v_gst_share numeric := 0;
    v_packaging_share numeric := 0;
    v_discount_share numeric := 0;
    v_rounding_share numeric := 0;
    v_refund_amount numeric := 0;
    v_order_uuid uuid;
    v_restaurant_name text;
    v_wallet_desc text;
BEGIN
    -- Only trigger refund if status changed to 'cancelled' or 'rejected'
    IF (NEW.sub_order_status = 'cancelled' OR NEW.sub_order_status = 'rejected') 
       AND (OLD.sub_order_status IS DISTINCT FROM 'cancelled' AND OLD.sub_order_status IS DISTINCT FROM 'rejected') THEN
        
        -- Set transaction-local session variable to prevent recursive update on this sub_order
        PERFORM set_config('app.current_updating_sub_order_id', NEW.id::text, true);

        -- Fetch parent order details
        SELECT user_id, payment_status, payment_method, total_price, total_food_price, gst_amount, packaging_charge, platform_fee, discount, rounding_adjustment, COALESCE(refunded_amount, 0)
        INTO v_customer_id, v_payment_status, v_payment_method, v_total_price, v_total_food_price, v_gst_amount, v_packaging_charge, v_platform_fee, v_discount, v_rounding_adjustment, v_refunded_so_far
        FROM public.orders
        WHERE id = NEW.main_order_id;

        IF v_customer_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- Calculate remaining active sub-orders (excluding this one)
        SELECT COUNT(*)
        INTO v_remaining_active_sub_orders
        FROM public.sub_orders
        WHERE main_order_id = NEW.main_order_id
          AND id <> NEW.id
          AND sub_order_status <> 'cancelled' AND sub_order_status <> 'rejected';

        -- Calculate proportional shares
        IF COALESCE(v_total_food_price, 0) > 0 THEN
            v_ratio := COALESCE(NEW.food_price_share, 0) / v_total_food_price;
        ELSE
            v_ratio := 0;
        END IF;

        v_gst_share := COALESCE(v_gst_amount, 0) * v_ratio;
        v_packaging_share := COALESCE(v_packaging_charge, 0) * v_ratio;
        v_discount_share := COALESCE(v_discount, 0) * v_ratio;
        v_rounding_share := COALESCE(v_rounding_adjustment, 0) * v_ratio;

        -- Calculate Refund Amount
        IF v_remaining_active_sub_orders = 0 THEN
            v_refund_amount := v_total_price - v_refunded_so_far;
        ELSE
            v_refund_amount := COALESCE(NEW.food_price_share, 0) + COALESCE(NEW.delivery_charge_share, 0) + v_gst_share + v_packaging_share - v_discount_share + v_rounding_share;
        END IF;

        -- Ensure refund amount is not negative
        IF v_refund_amount < 0 THEN
            v_refund_amount := 0;
        END IF;

        -- Issue Refund to Wallet ONLY IF paid (not cash)
        IF v_payment_method IS NOT NULL AND v_payment_status IS NOT NULL 
           AND lower(v_payment_method) NOT IN ('cash', 'cash on delivery', 'cod') 
           AND (lower(v_payment_status) IN ('completed', 'paid', 'success') OR lower(v_payment_method) = 'wallet') THEN
            
            UPDATE public.users
            SET wallet = COALESCE(wallet, 0) + v_refund_amount
            WHERE id = v_customer_id;

            -- Fetch restaurant name for description
            SELECT name INTO v_restaurant_name FROM public.restaurants WHERE id = NEW.restaurant_id LIMIT 1;
            v_wallet_desc := 'Refund for cancelled sub-order ' || NEW.id::text || ' (Reason: ' || COALESCE(NEW.cancellation_reason, NEW.rejection_reason, 'No reason') || ')';
            IF v_restaurant_name IS NOT NULL THEN
                v_wallet_desc := v_wallet_desc || ' from ' || v_restaurant_name;
            END IF;

            -- Safe cast check for main_order_id to UUID
            IF NEW.main_order_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
                v_order_uuid := NEW.main_order_id::uuid;
            ELSE
                v_order_uuid := NULL;
            END IF;

            INSERT INTO public.wallet_transactions (
                id,
                user_id,
                amount,
                transaction_type,
                description,
                order_id,
                created_at
            ) VALUES (
                gen_random_uuid(),
                v_customer_id,
                v_refund_amount,
                'credit',
                v_wallet_desc,
                v_order_uuid,
                now()
            );
        END IF;

        -- Set refunded_amount on NEW record
        NEW.refunded_amount := v_refund_amount;

        -- Update parent order's refunded_amount and status if no active sub-orders left
        UPDATE public.orders
        SET refunded_amount = COALESCE(refunded_amount, 0) + v_refund_amount
        WHERE id = NEW.main_order_id;

        IF v_remaining_active_sub_orders = 0 THEN
            UPDATE public.orders
            SET status = 'cancelled',
                payment_status = CASE 
                    WHEN lower(v_payment_method) NOT IN ('cash', 'cash on delivery', 'cod') AND (lower(v_payment_status) IN ('completed', 'paid', 'success') OR lower(v_payment_method) = 'wallet') THEN 'refunded' 
                    ELSE payment_status 
                END
            WHERE id = NEW.main_order_id;
        END IF;

    END IF;

    RETURN NEW;
END;
$function$;


-- 2. Update sync_completed_order_sub_orders to read and respect the session variable
CREATE OR REPLACE FUNCTION public.sync_completed_order_sub_orders()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_updating_so_id TEXT;
BEGIN
    -- Retrieve the sub-order currently being updated in this transaction session (if any)
    v_updating_so_id := current_setting('app.current_updating_sub_order_id', true);

    IF (NEW.status = 'completed' OR NEW.status = 'delivered') AND (OLD.status != 'completed' AND OLD.status != 'delivered') THEN
        UPDATE public.sub_orders
        SET sub_order_status = 'delivered'
        WHERE main_order_id = NEW.id 
          AND sub_order_status != 'delivered' 
          AND sub_order_status != 'cancelled'
          AND sub_order_status != 'rejected';
    ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        UPDATE public.sub_orders
        SET sub_order_status = 'cancelled'
        WHERE main_order_id = NEW.id 
          AND id::text != COALESCE(v_updating_so_id, '')
          AND sub_order_status != 'cancelled'
          AND sub_order_status != 'rejected';
    END IF;
    RETURN NEW;
END;
$function$;
