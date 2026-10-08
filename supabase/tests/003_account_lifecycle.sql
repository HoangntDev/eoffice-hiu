begin;
select plan(8);

insert into auth.users(id, email)
values ('40000000-0000-4000-8000-000000000001', 'signup-flow-test@gmail.com');

select ok(
  public.reserve_account_registration('0000000091', 'signup-flow-test@gmail.com'),
  'reserves a new MSSV and Gmail before verification'
);
select isnt(
  public.reserve_account_registration('0000000091', 'another-signup-test@gmail.com'),
  true,
  'cannot reserve an MSSV twice'
);
select isnt(
  public.reserve_account_registration('0000000092', 'signup-flow-test@gmail.com'),
  true,
  'cannot reserve a Gmail twice'
);
select lives_ok(
  $$select public.complete_account_registration(
    '40000000-0000-4000-8000-000000000001', 'signup-flow-test@gmail.com'
  )$$,
  'verified email completes the pending registration'
);
select is(
  (select status from public.accounts where user_id = '40000000-0000-4000-8000-000000000001'),
  'pending_pin',
  'verified account must create a PIN before activation'
);
select ok(
  (select verified_at is not null from public.account_emails where user_id = '40000000-0000-4000-8000-000000000001'),
  'verified Gmail is recorded separately'
);

insert into public.pin_recovery_authorizations(token_hash, user_id, expires_at)
values ('recovery-token-hash', '40000000-0000-4000-8000-000000000001', now() + interval '15 minutes');
select ok(
  public.claim_pin_recovery('40000000-0000-4000-8000-000000000001', 'recovery-token-hash'),
  'recovery proof can be claimed once'
);
select isnt(
  public.claim_pin_recovery('40000000-0000-4000-8000-000000000001', 'recovery-token-hash'),
  true,
  'recovery proof cannot be reused'
);

select * from finish();
rollback;
