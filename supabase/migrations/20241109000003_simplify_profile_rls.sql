-- Simplify RLS policies to avoid infinite recursion

-- Drop all existing policies
DROP POLICY IF EXISTS "Children can read own profile" ON profiles;
DROP POLICY IF EXISTS "Parents can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Simple policy: users can manage their own profile
CREATE POLICY "Users can manage own profile"
    ON profiles FOR ALL
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow service role full access
CREATE POLICY "Service role full access"
    ON profiles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
