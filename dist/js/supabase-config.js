/* ===============================
   SUPABASE CONFIGURATION
================================ */

// Initialize the Supabase client
// IMPORTANT: Replace these with your actual Supabase Project URL and Anon Key
const supabaseUrl = "https://nezmjmkbextyjnoyappg.supabase.co";
const supabaseAnonKey = "sb_publishable_5FjzPovb66kVpfuel7U5dw_nsvEyE8Z"; // Public anon key (safe to expose)

export const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Configure Deep Linking for Capacitor Android
if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('appUrlOpen', (data) => {
        if (data.url && data.url.includes('com.habitos.app://')) {
            const incomingUrl = new URL(data.url);

            // Attempt to parse tokens from URL fragment implicitly
            if (incomingUrl.hash) {
                const hashParams = new URLSearchParams(incomingUrl.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (accessToken && refreshToken) {
                    supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    }).then(() => {
                        window.location.hash = ''; // clear hash
                    });
                }
            }

            // Fallback for code-based PKCE
            if (incomingUrl.search && !incomingUrl.hash) {
                window.location.search = incomingUrl.search;
            }
        }
    });
}

export async function loginWithGoogle() {
    if (!supabase) {
        console.error("Supabase client not initialized.");
        return { error: "Client not initialized" };
    }

    try {
        const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
        const redirectUrl = isCapacitor ? 'com.habitos.app://login-callback' : window.location.origin + window.location.pathname;

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
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
        const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
        const redirectUrl = isCapacitor ? 'com.habitos.app://login-callback' : window.location.origin + window.location.pathname;

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: redirectUrl
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
