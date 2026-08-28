-- LytHouse credential vault: encrypted-at-rest storage for integration secrets.
-- Existing plaintext project/integration token columns can be migrated into this vault
-- and removed after application rollout + credential rotation.
create extension if not exists pgcrypto;
create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  integration_type text not null,
  integration_id uuid,
  secret_name text not null,
  ciphertext bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,integration_type,integration_id,secret_name)
);
alter table public.integration_credentials enable row level security;
-- No client SELECT policy by design: decrypted credentials must never reach browsers.
revoke all on public.integration_credentials from anon, authenticated;

create or replace function public.store_integration_credential(
  p_workspace_id uuid,p_integration_type text,p_integration_id uuid,p_secret_name text,p_plaintext text,p_encryption_key text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if p_plaintext is null or length(p_plaintext)<8 then raise exception 'credential is empty or too short'; end if;
  insert into public.integration_credentials(workspace_id,integration_type,integration_id,secret_name,ciphertext)
  values(p_workspace_id,p_integration_type,p_integration_id,p_secret_name,pgp_sym_encrypt(p_plaintext,p_encryption_key,'cipher-algo=aes256'))
  on conflict(workspace_id,integration_type,integration_id,secret_name) do update set ciphertext=excluded.ciphertext,updated_at=now()
  returning id into v_id;return v_id;
end$$;
revoke all on function public.store_integration_credential(uuid,text,uuid,text,text,text) from public,anon,authenticated;

create or replace function public.read_integration_credential(p_credential_id uuid,p_encryption_key text)
returns text language sql security definer set search_path=public as $$select pgp_sym_decrypt(ciphertext,p_encryption_key) from public.integration_credentials where id=p_credential_id$$;
revoke all on function public.read_integration_credential(uuid,text) from public,anon,authenticated;
comment on table public.integration_credentials is 'Server-only encrypted credential vault. Invoke functions only from trusted Edge Functions using ENCRYPTION_KEY.';
