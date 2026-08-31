-- Prevent infinite recursion when evaluating admin access to profiles.
-- The previous policy queried public.profiles from a policy on public.profiles.

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

CREATE POLICY "Admins read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());
