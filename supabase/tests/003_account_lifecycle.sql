begin;
select plan(10);

insert into auth.users(id, email)
values ('40000000-0000-4000-8000-000000000001', 'signup0000091@student.hiu.vn');

select ok(
  public.reserve_account_registration('0000000091', 'signup0000091@student.hiu.vn'),
  'reserves a new MSSV and student email before verification'
);
select isnt(
  public.reserve_account_registration('0000000091', 'another0000091@student.hiu.vn'),
  true,
  'cannot reserve an MSSV twice'
);
select isnt(
  public.reserve_account_registration('0001110091', 'signup0000091@student.hiu.vn'),
  true,
  'cannot reserve a student email twice'
);
select isnt(
  public.reserve_account_registration('0000000093', 'signup0000093@gmail.com'),
  true,
  'rejects Gmail: only @student.hiu.vn is accepted'
);
select isnt(
  public.reserve_account_registration('0000000094', 'signup0009999@student.hiu.vn'),
  true,
  'rejects a student email whose number does not match the MSSV'
);
select lives_ok(
  $$select public.complete_account_registration(
    '40000000-0000-4000-8000-000000000001', 'signup0000091@student.hiu.vn'
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
  'verified student email is recorded separately'
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
