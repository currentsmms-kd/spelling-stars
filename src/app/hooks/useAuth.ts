import { useEffect, useCallback } from "react";
import { useAuthStore } from "../store/auth";
import { supabase } from "../supabase";
import { clearUserCaches } from "@/lib/cache";
import { logger } from "@/lib/logger";

export function useAuth() {
  const {
    user,
    profile,
    isLoading,
    setUser,
    setProfile,
    setIsLoading,
    logout,
  } = useAuthStore();

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (error) {
        logger.error("Error fetching profile:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [setProfile, setIsLoading]
  );

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // If we get an invalid refresh token error, clear the session
      if (error) {
        logger.warn("Session error detected, clearing auth state:", error);
        supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);

        // Clear caches when user signs out
        if (event === "SIGNED_OUT") {
          try {
            await clearUserCaches();
            logger.info("User caches cleared after auth state change");
          } catch (error) {
            logger.error("Failed to clear caches after sign-out:", error);
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setProfile, setIsLoading, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signUp = async (
    email: string,
    password: string,
    role: "parent" | "child" = "parent"
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    try {
      // Clear user-specific caches to prevent stale data
      await clearUserCaches();
      logger.info("User caches cleared on sign-out");
    } catch (error) {
      // Don't block sign-out if cache clearing fails
      logger.error("Failed to clear caches on sign-out:", error);
    }

    await supabase.auth.signOut();
    logout();
  };

  return {
    user,
    profile,
    isLoading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: Boolean(user),
    isParent: profile?.role === "parent",
    isChild: profile?.role === "child",
  };
}
