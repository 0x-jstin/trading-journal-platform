import { supabase } from "./auth.js";

const TABLE = "journal_states";

export async function loadCloudState(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("state, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? { state: data.state, updatedAt: data.updated_at } : null;
}

export async function saveCloudState(userId, state) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
}
export async function loadProfile(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, username, onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function completeOnboarding(userId) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("user_id", userId);
  if (error) throw error;
}