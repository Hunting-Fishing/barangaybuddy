# Ecosystem operations migration rollback

This migration is additive. Before rollback, export all commercial and operational records and stop order and delivery writes.

Drop dependent policies and functions first, then tables in reverse dependency order: `audit_events`, `support_cases`, `settlements`, `business_subscriptions`, `platform_commissions`, `platform_payments`, `driver_earnings`, `delivery_proofs`, `delivery_events`, `delivery_jobs`, `driver_availability`, `driver_vehicles`, `driver_profiles`, `marketplace_order_events`, `order_substitutions`, `marketplace_order_items`, `marketplace_orders`, `restaurant_reservations`, `modifier_options`, `modifier_groups`, `catalog_items`, `catalog_categories`, `catalogs`, `business_service_areas`, `business_hours`, and `business_locations`. Then drop the migration's enums and the private `delivery-proofs` bucket after its objects are archived.

Do not roll this migration back after real orders, proofs, earnings, payments, or settlements exist without a reviewed data-retention plan.
