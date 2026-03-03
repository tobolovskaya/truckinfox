# QA Checklist: Automotive Transport Flow

## Scope
Customer creates an automotive request, carriers bid, customer accepts, payment and delivery stages progress, and both sides see correct data in Orders and Request Details.

## Preconditions
- Two test accounts:
  - `customer` (creates request)
  - `carrier` (submits bid)
- App connected to active Supabase project.
- Push permissions enabled on both devices (or emulators with notification support).

## 1) Create automotive request (Customer)
- Open `Create cargo request`.
- Set cargo type to automotive.
- Fill fields:
  - VIN (optional)
  - Keys included
  - Wheel lock
  - Ground clearance
  - Needs winch
  - Transport type (`open trailer` / `enclosed`)
- Set fixed price.
- Verify price summary block shows:
  - Carrier bid
  - Platform fee (10%)
  - Total estimate
  - Insurance includes/hint text
- Publish request.

Expected:
- Request created successfully.
- In request details, vehicle condition + vehicle details card renders correctly.
- No legacy text tags like `[automotive_condition|...]` visible in description.

## 2) Submit bid (Carrier)
- Open customer automotive request.
- Submit valid bid.

Expected:
- Success feedback shown.
- `Orders / Bestillinger` shows new pending/provisional entry for carrier.
- `Orders / Bestillinger` also shows matching pending entry for customer.

## 3) Bid quality in request details
- On customer request details screen, inspect bid cards.

Expected:
- Each bid shows:
  - completed transports
  - on-time rate (or fallback `On-time n/a`)
  - review count
  - ETA risk label (`Low/Medium/High/Unknown`)

## 4) Accept bid (Customer)
- Customer accepts one bid.

Expected:
- Selected bid status becomes `accepted`.
- Other pending bids become `rejected`.
- Request status becomes `accepted`.
- Payment navigation opens existing order tied to accepted bid.
- Push/notification for stage transition (pickup confirmed planning) appears for customer.

## 5) Start transport (Carrier)
- Open accepted order status as carrier.
- Tap `Start transport`.

Expected:
- Order status updates to `in_transit`.
- Request status syncs to `in_transit`.
- Customer request checklist marks:
  - pickup confirmed = done
  - in transit = done
  - delivered = pending
- Stage push/notification appears for customer.

## 6) Confirm delivery (Customer)
- Open order status as customer when in transit.
- Confirm delivery.

Expected:
- Order status updates to `delivered`.
- Request status syncs to `delivered`.
- Checklist marks all steps done.
- Funds release flow executes (or fallback message if payout pending).
- Stage push/notification appears for customer.

## 7) Regression sanity
- `Orders` list opens without errors for both users.
- `Request details` loads without runtime errors.
- Editing automotive request preserves new automotive fields.
- Localization: EN/NO labels for new fields and risk/status texts display correctly.

## Fast SQL spot checks (optional)
- Validate provisional order creation after bid:
  - `orders.bid_id` exists for newly inserted `bids.id`.
- Validate status sync:
  - `orders.status` changes to `active` when `bids.status = accepted`.
  - `cargo_requests.status` tracks `accepted -> in_transit -> delivered`.
- Validate stage notifications:
  - New rows in `notifications` with `type = order_status_change` for each stage update.

## Pass criteria
- All expected outcomes above pass with no manual DB fixes.
- No blocked flow for customer or carrier in the automotive scenario.
