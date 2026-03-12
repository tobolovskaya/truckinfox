-- Fix fee calculation in provisional order trigger.
-- Previous formula: total_amount = bid.price + fee  (charged customer 110%)
-- Correct formula:  total_amount = bid.price        (customer pays bid price)
--                   platform_fee = bid.price * 10%
--                   carrier_amount = bid.price * 90%

CREATE OR REPLACE FUNCTION public.create_provisional_order_on_bid_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row RECORD;
  fee NUMERIC(12, 2);
BEGIN
  IF NEW.request_id IS NULL OR NEW.carrier_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF lower(coalesce(NEW.status, 'pending')) <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT id, customer_id
  INTO request_row
  FROM public.cargo_requests
  WHERE id = NEW.request_id;

  IF request_row.id IS NULL OR request_row.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.bid_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  fee := round((coalesce(NEW.price, 0) * 0.10)::numeric, 2);

  INSERT INTO public.orders (
    request_id,
    bid_id,
    customer_id,
    carrier_id,
    total_amount,
    platform_fee,
    carrier_amount,
    status,
    payment_status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.request_id,
    NEW.id,
    request_row.customer_id,
    NEW.carrier_id,
    coalesce(NEW.price, 0),              -- customer pays bid price (not price + fee)
    fee,                                  -- platform keeps 10%
    coalesce(NEW.price, 0) - fee,         -- carrier nets 90%
    'pending',
    'pending',
    now(),
    now()
  );

  RETURN NEW;
END;
$$;
