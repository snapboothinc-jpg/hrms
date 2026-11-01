-- Supporting storage policies, audit-history access and pinned trigger search paths.


-- ===== storage: private evidence bucket, own-folder uploads only; reads via server-signed URLs =====
create policy "evidence upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id='evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "evidence read own uploads" on storage.objects for select to authenticated
  using (bucket_id='evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "hr reads employee history" on public.audit_logs for select to authenticated
  using (public.has_perm('hr.employees') and table_name in ('employees','reporting_relationships'));
alter function public.tg_audit_immutable() set search_path = public;
alter function public.tg_snapshot_immutable() set search_path = public;
