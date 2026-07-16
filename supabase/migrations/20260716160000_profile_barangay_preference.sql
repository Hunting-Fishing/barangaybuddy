alter table public.profiles
  add column if not exists barangay_code text references public.barangays(code) on update cascade on delete set null;

create index if not exists profiles_barangay_code_idx
  on public.profiles (barangay_code);

comment on column public.profiles.barangay_code is
  'Default barangay preference used to prefill business creation forms.';