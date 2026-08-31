alter table public.integrations add column if not exists credentials_encrypted text;
-- New writes must use the integration-secrets Edge Function. Keep the legacy column only for migration compatibility.
comment on column public.integrations.credentials_encrypted is 'AES-GCM ciphertext written only by integration-secrets Edge Function; ENCRYPTION_KEY lives in Edge Function secrets.';
revoke update(credentials_encrypted) on public.integrations from authenticated, anon;
