# Marketplace customer workflows rollback

This migration contains operational security fixes as well as workflow commands. Before rollback, export pending substitutions, reservations, support cases, and proof metadata, then pause customer and merchant writes.

1. Drop `respond_order_substitution`, `propose_order_substitution`, and `transition_restaurant_reservation`.
2. Drop the `Admins update support cases` and `Order participants read proof objects` policies.
3. Restore the prior `Users open support cases` policy only if its weaker linked-order ownership behavior is explicitly accepted.
4. Restore the previous `create_marketplace_order` definition only after confirming that no active catalog relies on modifiers; the earlier function does not include or price modifier selections.

Historical accepted substitutions and updated order totals are not automatically reversible. Restore them from the pre-rollback export if required.
