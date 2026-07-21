/*
# (Intentionally a no-op)

This migration was previously an exact duplicate of
`20260714032643_green_block.sql` (the Stripe integration schema). Running both in
sequence fails, because `CREATE TYPE stripe_subscription_status` /
`stripe_order_status` and the `stripe_user_*` views have no IF-NOT-EXISTS guard
and collide on the second apply.

The Stripe schema is owned by `green_block`. This file is left as a no-op so the
migration history stays intact without re-creating those objects.
*/
select 1;
