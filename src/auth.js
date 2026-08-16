import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const localMode = import.meta.env.VITE_AUTH_MODE === "local";
const localEmail = import.meta.env.VITE_LOCAL_EMAIL || "";
const localPassword = import.meta.env.VITE_LOCAL_PASSWORD || "";
const localSessionKey = "trading-journal-local-session";

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const authMode = localMode ? "local" : "supabase";

export async function getAuthUser() {
  if (localMode) {
    return sessionStorage.getItem(localSessionKey)
      ? { email: localEmail, id: "local-development-user" }
      : null;
  }
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function signIn(email, password) {
  if (localMode) {
    if (email !== localEmail || password !== localPassword) {
      throw new Error("Incorrect email or password.");
    }
    sessionStorage.setItem(localSessionKey, email);
    return { email, id: "local-development-user" };
  }
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the required environment variables.");
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  if (localMode) {
    sessionStorage.removeItem(localSessionKey);
    return;
  }
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  if (!supabase || localMode) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user || null));
  return () => data.subscription.unsubscribe();
}