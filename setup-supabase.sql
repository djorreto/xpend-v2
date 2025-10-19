-- ---------- PROJECT FILES (usar pr.id en vez de id) ----------
drop policy if exists "Users can view project files in their company" on storage.objects;
create policy "Users can view project files in their company"
on storage.objects
for select using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] in (
    select pr.id::text
    from public.projects pr
    join public.profiles p on p.company_id = pr.company_id
    where p.id = auth.uid()
  )
);

drop policy if exists "Users can upload project files in their company" on storage.objects;
create policy "Users can upload project files in their company"
on storage.objects
for insert with check (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] in (
    select pr.id::text
    from public.projects pr
    join public.profiles p on p.company_id = pr.company_id
    where p.id = auth.uid()
  )
);

drop policy if exists "Users can update project files in their company" on storage.objects;
create policy "Users can update project files in their company"
on storage.objects
for update using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] in (
    select pr.id::text
    from public.projects pr
    join public.profiles p on p.company_id = pr.company_id
    where p.id = auth.uid()
  )
);

drop policy if exists "Users can delete project files in their company" on storage.objects;
create policy "Users can delete project files in their company"
on storage.objects
for delete using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] in (
    select pr.id::text
    from public.projects pr
    join public.profiles p on p.company_id = pr.company_id
    where p.id = auth.uid()
  )
);

-- ---------- LICITACION DOCUMENTS (usar l.id en vez de id) ----------
drop policy if exists "Users can view licitacion documents in their company" on storage.objects;
create policy "Users can view licitacion documents in their company"
on storage.objects
for select using (
  bucket_id = 'licitacion-documents'
  and (storage.foldername(name))[1] in (
    select l.id::text
    from public.licitaciones l
    join public.profiles p on p.company_id = l.company_id
    where p.id = auth.uid()
  )
);

drop policy if exists "Users can upload licitacion documents in their company" on storage.objects;
create policy "Users can upload licitacion documents in their company"
on storage.objects
for insert with check (
  bucket_id = 'licitacion-documents'
  and (storage.foldername(name))[1] in (
    select l.id::text
    from public.licitaciones l
    join public.profiles p on p.company_id = l.company_id
    where p.id = auth.uid()
  )
);

drop policy if exists "Users can update licitacion documents in their company" on storage.objects;
create policy "Users can update licitacion documents in their company"
on storage.objects
for update using (
  bucket_id = 'licitacion-documents'
  and (storage.foldername(name))[1] in (
    select l.id::text
    from public.licitaciones l
    join public.profiles p on p.company_id = l.company_id
    where p.id = auth.uid()
  )
);

drop policy if exists "Users can delete licitacion documents in their company" on storage.objects;
create policy "Users can delete licitacion documents in their company"
on storage.objects
for delete using (
  bucket_id = 'licitacion-documents'
  and (storage.foldername(name))[1] in (
    select l.id::text
    from public.licitaciones l
    join public.profiles p on p.company_id = l.company_id
    where p.id = auth.uid()
  )
);

-- ---------- SPEND DATA (usar company_id) ----------
drop policy if exists "Users can view spend data in their company" on storage.objects;
create policy "Users can view spend data in their company"
on storage.objects
for select using (
  bucket_id = 'spend-data'
  and (storage.foldername(name))[1] in (
    select company_id::text
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Users can upload spend data in their company" on storage.objects;
create policy "Users can upload spend data in their company"
on storage.objects
for insert with check (
  bucket_id = 'spend-data'
  and (storage.foldername(name))[1] in (
    select company_id::text
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Users can update spend data in their company" on storage.objects;
create policy "Users can update spend data in their company"
on storage.objects
for update using (
  bucket_id = 'spend-data'
  and (storage.foldername(name))[1] in (
    select company_id::text
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Users can delete spend data in their company" on storage.objects;
create policy "Users can delete spend data in their company"
on storage.objects
for delete using (
  bucket_id = 'spend-data'
  and (storage.foldername(name))[1] in (
    select company_id::text
    from public.profiles
    where id = auth.uid()
  )
);

-- ---------- USER AVATARS (public) ----------
drop policy if exists "Users can view all avatars" on storage.objects;
create policy "Users can view all avatars"
on storage.objects
for select using (bucket_id = 'user-avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
on storage.objects
for insert with check (
  bucket_id = 'user-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
on storage.objects
for update using (
  bucket_id = 'user-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
on storage.objects
for delete using (
  bucket_id = 'user-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- ---------- REPORTS (usar company_id) ----------
drop policy if exists "Users can view reports in their company" on storage.objects;
create policy "Users can view reports in their company"
on storage.objects
for select using (
  bucket_id = 'reports'
  and (storage.foldername(name))[1] in (
    select company_id::text
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Users can upload reports in their company" on storage.objects;
create policy "Users can upload reports in their company"
on storage.objects
for insert with check (
  bucket_id = 'reports'
  and (storage.foldername(name))[1] in (
    select company_id::text
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Users can update reports in their company" on storage.objects;
create policy "Users can update reports in their company"
on storage.objects
for update using (
  bucket_id = 'reports'
  and (storage.foldername(name))[1] in (
    select company_id::text
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Users can delete reports in their company" on storage.objects;
create policy "Users can delete reports in their company"
on storage.objects
for delete using (
  bucket_id = 'reports'
  and (storage.foldername(name))[1] in (
    select company_id::text
    from public.profiles
    where id = auth.uid()
  )
);

