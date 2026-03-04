// Z-ARC SYSTEM: Supabase Configuration Template
// Copy this file to 'supabase-config.js' and fill in your actual keys.
// DO NOT push the actual 'supabase-config.js' to GitHub.

const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-public-anon-key-here';

// Initialize the client (Make sure the Supabase CDN is loaded in index.html)
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in Node 01 (Habits) and Node 02 (Workout)
window.supabaseClient = supabase;

console.log("Z-ARC: Supabase Sample Config Loaded. Replace with real keys locally.");