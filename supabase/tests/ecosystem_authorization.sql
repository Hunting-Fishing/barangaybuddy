-- Run after `supabase db reset` with: supabase test db
begin;
select plan(12);
select has_table('public','family_groups','family groups exist');
select has_table('public','minor_consents','minor consent ledger exists');
select has_table('public','spotlight_votes','Spotlight votes exist');
select has_table('public','business_locations','merchant locations exist');
select has_table('public','marketplace_orders','Marketplace orders exist');
select has_table('public','marketplace_order_events','immutable order events exist');
select has_table('public','driver_profiles','driver profiles exist');
select has_table('public','delivery_events','immutable delivery events exist');
select has_function('public','transition_marketplace_order',array['uuid','marketplace_order_status','text'],'order transition command exists');
select has_function('public','transition_delivery',array['uuid','delivery_status','text'],'delivery transition command exists');
select policies_are('public','marketplace_orders',array['Participants read orders'],'orders can only be created through the validated RPC');
select policies_are('public','driver_profiles',array['Admins review drivers','Adults apply as drivers','Drivers read own profile'],'driver policies are explicit');
select * from finish();
rollback;
