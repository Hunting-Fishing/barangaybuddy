-- Enum additions are isolated because PostgreSQL requires a commit before new values are referenced.
alter type public.spotlight_inquiry_status add value if not exists 'talent_review';
alter type public.spotlight_inquiry_status add value if not exists 'accepted';
alter type public.spotlight_inquiry_status add value if not exists 'declined';
alter type public.spotlight_inquiry_status add value if not exists 'confirmed';
alter type public.spotlight_inquiry_status add value if not exists 'completed';
alter type public.spotlight_inquiry_status add value if not exists 'cancelled';
alter type public.spotlight_inquiry_status add value if not exists 'disputed';
