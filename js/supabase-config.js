/* ===============================
   SUPABASE CONFIGURATION
================================ */

// Initialize the Supabase client
// IMPORTANT: Replace these with your actual Supabase Project URL and Anon Key
const supabaseUrl = "https://nezmjmkbextyjnoyappg.supabase.co";
const supabaseAnonKey = "sb_publishable_5FjzPovb66kVpfuel7U5dw_nsvEyE8Z";

export const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

export async function loginWithGoogle() {
    if (!supabase) {
        console.error("Supabase client not initialized.");
        return { error: "Client not initialized" };
    }

    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: 'http://127.0.0.1:5500'
            }
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("[SUPABASE] Google Login failed:", error.message);
        throw error;
    }
}

export async function loginWithGithub() {
    if (!supabase) {
        console.error("Supabase client not initialized.");
        return { error: "Client not initialized" };
    }

    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: 'http://127.0.0.1:5500'
            }
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("[SUPABASE] GitHub Login failed:", error.message);
        throw error;
    }
}

export async function logout() {
    if (!supabase) return;
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        console.log("[SUPABASE] Logged out");
        window.location.reload();
    } catch (error) {
        console.error("[SUPABASE] Logout failed:", error.message);
    }
}

// Global hook for auth state changes if needed
export function onAuthStateChange(callback) {
    if (!supabase) return null;
    return supabase.auth.onAuthStateChange(callback);
}

export async function getCurrentUser() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}
