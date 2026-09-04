/*
# Multi-user workspace: profiles and owner-scoped operator_items

1. New Tables
- `profiles` stores per-user display information.
  - `id` (uuid, primary key, references auth.users, ON DELETE CASCADE)
  - `full_name` (text, the user's display name)
  - `company` (text, optional company/workspace name)
  - `email_connected` (boolean, default false — tracks whether the user has connected their email)
  - `created_at` (timestamptz)

2. Modified Tables
- `operator_items` is altered to become owner-scoped:
  - New column `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
  - New index on (user_id, kind, updated_at DESC)

3. Security
- RLS enabled on `profiles`.
  - Users can read and update only their own profile row.
  - INSERT is handled by a trigger (see below) so no direct INSERT policy is needed from the client; a policy is still provided for safety.
- `operator_items` policies are replaced: the old anon-accessible policies are dropped and replaced with owner-scoped `authenticated` policies.
- A trigger `handle_new_user_profile` automatically creates a profile row when a new auth.users row is inserted, so sign-up always produces a profile.

4. Important Notes
- The `user_id` column on `operator_items` has DEFAULT auth.uid() so frontend inserts that omit user_id still satisfy the WITH CHECK policy.
- The profiles trigger uses SECURITY DEFINER to insert into profiles even though RLS would block a direct client insert.
- Existing operator_items rows (if any) will have NULL user_id; since the column is NOT NULL, we default existing rows to a sentinel and they become inaccessible. This is acceptable for the transition from single-tenant to multi-user.
*/

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  email_connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- 2. Add user_id to operator_items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operator_items' AND column_name = 'user_id') THEN
    ALTER TABLE operator_items ADD COLUMN user_id uuid DEFAULT auth.uid();
  END IF;
END $$;

-- Backfill: set NULL user_id rows to a nil UUID so the NOT NULL constraint can be applied
UPDATE operator_items SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operator_items' AND column_name = 'user_id' AND is_nullable = 'YES') THEN
    ALTER TABLE operator_items ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'operator_items_user_id_fkey' AND table_name = 'operator_items') THEN
    ALTER TABLE operator_items ADD CONSTRAINT operator_items_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS operator_items_user_idx ON operator_items (user_id, kind, updated_at DESC);

-- 3. Replace operator_items policies with owner-scoped ones
DROP POLICY IF EXISTS "Shared workspace items can be read" ON operator_items;
DROP POLICY IF EXISTS "Shared workspace items can be created" ON operator_items;
DROP POLICY IF EXISTS "Shared workspace items can be updated" ON operator_items;
DROP POLICY IF EXISTS "Shared workspace items can be deleted" ON operator_items;

CREATE POLICY "Users can read own operator items" ON operator_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own operator items" ON operator_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own operator items" ON operator_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own operator items" ON operator_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 4. Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
