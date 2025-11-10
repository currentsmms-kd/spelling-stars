-- Migration: Add D4 Rewards Shop Features
-- Creates rewards catalog, user rewards tracking, and extends profiles with avatar/theme

-- Step 1: Extend profiles table with stars, streak, and equipped items
DO $$
BEGIN
    -- Add stars (migrating from rewards table concept to profiles)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'stars'
    ) THEN
        ALTER TABLE profiles ADD COLUMN stars INTEGER DEFAULT 0 CHECK (stars >= 0);
        CREATE INDEX IF NOT EXISTS idx_profiles_stars ON profiles(stars);
        COMMENT ON COLUMN profiles.stars IS 'Total stars earned by user (child only)';
    END IF;

    -- Add streak tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'streak_days'
    ) THEN
        ALTER TABLE profiles ADD COLUMN streak_days INTEGER DEFAULT 0 CHECK (streak_days >= 0);
        COMMENT ON COLUMN profiles.streak_days IS 'Current consecutive days of practice';
    END IF;

    -- Add last_active for streak calculation
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'last_active'
    ) THEN
        ALTER TABLE profiles ADD COLUMN last_active DATE DEFAULT CURRENT_DATE;
        CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active);
        COMMENT ON COLUMN profiles.last_active IS 'Last date user was active (for streak calculation)';
    END IF;

    -- Add equipped avatar
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'equipped_avatar'
    ) THEN
        ALTER TABLE profiles ADD COLUMN equipped_avatar TEXT DEFAULT NULL;
        COMMENT ON COLUMN profiles.equipped_avatar IS 'Currently equipped avatar ID from rewards catalog';
    END IF;

    -- Add equipped theme
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'equipped_theme'
    ) THEN
        ALTER TABLE profiles ADD COLUMN equipped_theme TEXT DEFAULT 'kawaii-pink';
        COMMENT ON COLUMN profiles.equipped_theme IS 'Currently equipped color theme ID';
    END IF;
END $$;

-- Step 2: Create rewards_catalog table
CREATE TABLE IF NOT EXISTS rewards_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cost_stars INTEGER NOT NULL CHECK (cost_stars >= 0),
    icon TEXT NOT NULL,  -- Emoji or icon name
    type TEXT NOT NULL CHECK (type IN ('avatar', 'theme', 'coupon', 'badge')),
    is_active BOOLEAN DEFAULT true,  -- Can be deactivated by parent
    metadata JSONB DEFAULT '{}'::jsonb,  -- Extra data (e.g., theme colors, coupon details)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rewards_catalog_type ON rewards_catalog(type);
CREATE INDEX IF NOT EXISTS idx_rewards_catalog_active ON rewards_catalog(is_active);

COMMENT ON TABLE rewards_catalog IS 'Catalog of rewards available for purchase with stars';
COMMENT ON COLUMN rewards_catalog.type IS 'Type of reward: avatar, theme, coupon (parent-defined), or badge';
COMMENT ON COLUMN rewards_catalog.metadata IS 'Additional data specific to reward type (theme colors, coupon details, etc.)';

-- Step 3: Create user_rewards table (earned/purchased rewards)
CREATE TABLE IF NOT EXISTS user_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards_catalog(id) ON DELETE CASCADE,
    acquired_at TIMESTAMPTZ DEFAULT now(),
    equipped BOOLEAN DEFAULT false,
    UNIQUE(user_id, reward_id)  -- User can't own same reward twice
);

CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_equipped ON user_rewards(user_id, equipped);

COMMENT ON TABLE user_rewards IS 'Tracks which rewards each user has purchased/earned';
COMMENT ON COLUMN user_rewards.equipped IS 'Whether this reward is currently equipped (for avatars/themes)';

-- Step 4: Enable RLS on new tables
ALTER TABLE rewards_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

-- RLS for rewards_catalog (everyone can read, only parents can modify)
CREATE POLICY "Anyone authenticated can view rewards catalog"
    ON rewards_catalog FOR SELECT
    TO authenticated
    USING (is_active = true);

CREATE POLICY "Parents can manage rewards catalog"
    ON rewards_catalog FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

-- RLS for user_rewards (users can view/manage their own)
CREATE POLICY "Users can view own rewards"
    ON user_rewards FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rewards"
    ON user_rewards FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rewards"
    ON user_rewards FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Parents can view all user rewards (for monitoring)
CREATE POLICY "Parents can view all user rewards"
    ON user_rewards FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
        )
    );

-- Step 5: Create function to purchase reward
CREATE OR REPLACE FUNCTION purchase_reward(
    p_user_id UUID,
    p_reward_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cost INTEGER;
    v_current_stars INTEGER;
    v_reward_name TEXT;
    v_reward_type TEXT;
BEGIN
    -- Get reward details
    SELECT cost_stars, name, type INTO v_cost, v_reward_name, v_reward_type
    FROM rewards_catalog
    WHERE id = p_reward_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reward not found or not active'
        );
    END IF;

    -- Get current stars
    SELECT stars INTO v_current_stars
    FROM profiles
    WHERE id = p_user_id;

    IF v_current_stars < v_cost THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient stars',
            'required', v_cost,
            'available', v_current_stars
        );
    END IF;

    -- Check if already owned
    IF EXISTS (SELECT 1 FROM user_rewards WHERE user_id = p_user_id AND reward_id = p_reward_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reward already owned'
        );
    END IF;

    -- Deduct stars
    UPDATE profiles
    SET stars = stars - v_cost
    WHERE id = p_user_id;

    -- Add to user_rewards
    INSERT INTO user_rewards (user_id, reward_id, equipped)
    VALUES (p_user_id, p_reward_id, false);

    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'reward_name', v_reward_name,
        'reward_type', v_reward_type,
        'cost', v_cost,
        'remaining_stars', v_current_stars - v_cost
    );
END;
$$;

COMMENT ON FUNCTION purchase_reward IS 'Safely purchase a reward, deducting stars and preventing double-spend';

-- Step 6: Create function to equip reward (avatar or theme)
CREATE OR REPLACE FUNCTION equip_reward(
    p_user_id UUID,
    p_reward_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reward_type TEXT;
    v_reward_icon TEXT;
BEGIN
    -- Check if user owns this reward
    IF NOT EXISTS (
        SELECT 1 FROM user_rewards
        WHERE user_id = p_user_id AND reward_id = p_reward_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reward not owned'
        );
    END IF;

    -- Get reward type
    SELECT type, icon INTO v_reward_type, v_reward_icon
    FROM rewards_catalog
    WHERE id = p_reward_id;

    -- Unequip all other rewards of same type for this user
    UPDATE user_rewards
    SET equipped = false
    WHERE user_id = p_user_id
      AND reward_id IN (
          SELECT id FROM rewards_catalog WHERE type = v_reward_type
      );

    -- Equip this reward
    UPDATE user_rewards
    SET equipped = true
    WHERE user_id = p_user_id AND reward_id = p_reward_id;

    -- Update profile equipped column
    IF v_reward_type = 'avatar' THEN
        UPDATE profiles
        SET equipped_avatar = v_reward_icon
        WHERE id = p_user_id;
    ELSIF v_reward_type = 'theme' THEN
        UPDATE profiles
        SET equipped_theme = v_reward_icon
        WHERE id = p_user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'reward_type', v_reward_type,
        'equipped', v_reward_icon
    );
END;
$$;

COMMENT ON FUNCTION equip_reward IS 'Equip a reward (avatar or theme), unequipping others of same type';

-- Step 7: Create function to award stars (replaces old fn_add_stars)
CREATE OR REPLACE FUNCTION award_stars(
    p_user_id UUID,
    p_amount INTEGER,
    p_reason TEXT DEFAULT 'practice'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_total INTEGER;
BEGIN
    -- Add stars to profile
    UPDATE profiles
    SET stars = stars + p_amount
    WHERE id = p_user_id
    RETURNING stars INTO v_new_total;

    RETURN v_new_total;
END;
$$;

COMMENT ON FUNCTION award_stars IS 'Award stars to a user (child). Returns new total.';

-- Step 8: Create function to update daily streak
CREATE OR REPLACE FUNCTION update_daily_streak(
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_active DATE;
    v_current_streak INTEGER;
    v_new_streak INTEGER;
    v_bonus_stars INTEGER := 0;
BEGIN
    -- Get current values
    SELECT last_active, streak_days INTO v_last_active, v_current_streak
    FROM profiles
    WHERE id = p_user_id;

    -- Calculate new streak
    IF v_last_active = CURRENT_DATE THEN
        -- Already updated today, no change
        RETURN jsonb_build_object(
            'streak_days', v_current_streak,
            'bonus_stars', 0,
            'continued', false
        );
    ELSIF v_last_active = CURRENT_DATE - 1 THEN
        -- Consecutive day, increment streak
        v_new_streak := v_current_streak + 1;

        -- Award bonus stars for milestones
        IF v_new_streak % 7 = 0 THEN
            v_bonus_stars := 10;  -- Weekly streak bonus
        ELSIF v_new_streak % 3 = 0 THEN
            v_bonus_stars := 5;   -- 3-day streak bonus
        END IF;

    ELSIF v_last_active < CURRENT_DATE - 1 THEN
        -- Streak broken (gap > 36 hours), reset to 1
        v_new_streak := 1;
    ELSE
        -- Last active is in the future? This shouldn't happen, reset
        v_new_streak := 1;
    END IF;

    -- Update profile
    UPDATE profiles
    SET
        streak_days = v_new_streak,
        last_active = CURRENT_DATE,
        stars = stars + v_bonus_stars
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'streak_days', v_new_streak,
        'bonus_stars', v_bonus_stars,
        'continued', v_new_streak > v_current_streak
    );
END;
$$;

COMMENT ON FUNCTION update_daily_streak IS 'Updates daily streak for user. Resets after 36h gap. Awards bonus stars for milestones (3-day: +5, 7-day: +10).';

-- Step 9: Seed initial rewards catalog
INSERT INTO rewards_catalog (name, description, cost_stars, icon, type, metadata)
VALUES
    -- Avatars
    ('Happy Star', 'A cheerful star avatar', 10, '⭐', 'avatar', '{"emoji": "⭐"}'::jsonb),
    ('Cool Cat', 'A cool cat avatar', 15, '😎', 'avatar', '{"emoji": "😎"}'::jsonb),
    ('Wizard', 'A magical wizard avatar', 20, '🧙', 'avatar', '{"emoji": "🧙"}'::jsonb),
    ('Rainbow', 'A colorful rainbow avatar', 25, '🌈', 'avatar', '{"emoji": "🌈"}'::jsonb),
    ('Rocket', 'A space rocket avatar', 30, '🚀', 'avatar', '{"emoji": "🚀"}'::jsonb),
    ('Crown', 'A royal crown avatar', 50, '👑', 'avatar', '{"emoji": "👑"}'::jsonb),

    -- Themes (using existing theme IDs from themes.ts)
    ('Kawaii Pink Theme', 'Cute pink theme', 5, 'kawaii-pink', 'theme', '{"themeId": "kawaii-pink"}'::jsonb),
    ('Blue Scholar Theme', 'Professional blue theme', 10, 'blue-scholar', 'theme', '{"themeId": "blue-scholar"}'::jsonb),
    ('Forest Green Theme', 'Natural green theme', 15, 'forest-green', 'theme', '{"themeId": "forest-green"}'::jsonb),
    ('Sunset Glow Theme', 'Warm sunset theme', 20, 'sunset-glow', 'theme', '{"themeId": "sunset-glow"}'::jsonb),
    ('Midnight Dark Theme', 'Cool dark theme', 25, 'midnight-dark', 'theme', '{"themeId": "midnight-dark"}'::jsonb),

    -- Badge rewards (virtual achievements)
    ('Speed Star Badge', 'Completed 10 words in under 60 seconds', 30, '⚡', 'badge', '{"achievement": "speed_10"}'::jsonb),
    ('Perfect Week Badge', '7 days perfect practice', 50, '🏆', 'badge', '{"achievement": "perfect_week"}'::jsonb),
    ('100 Star Champion', 'Earned 100 total stars', 0, '💯', 'badge', '{"achievement": "stars_100", "auto_award": true}'::jsonb)
ON CONFLICT DO NOTHING;

-- Step 10: Migrate existing rewards data to profiles
-- Copy stars_total from rewards table to profiles.stars for existing children
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rewards') THEN
        UPDATE profiles p
        SET stars = COALESCE(r.stars_total, 0),
            streak_days = COALESCE(r.streak_current, 0)
        FROM rewards r
        WHERE p.id = r.child_id AND p.role = 'child';
    END IF;
END $$;

-- Step 11: Create triggers for updated_at
CREATE TRIGGER update_rewards_catalog_updated_at
    BEFORE UPDATE ON rewards_catalog
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 12: Grant permissions
GRANT EXECUTE ON FUNCTION purchase_reward TO authenticated;
GRANT EXECUTE ON FUNCTION equip_reward TO authenticated;
GRANT EXECUTE ON FUNCTION award_stars TO authenticated;
GRANT EXECUTE ON FUNCTION update_daily_streak TO authenticated;
