import { supabase, getCurrentUser, onAuthStateChange } from './supabase-config.js';

import { initializeHabits, renderHabits, setupAddHabitModal, setupEditHabitModal, setupDeleteHabitModal } from './habits.js';
import { generateWeek, restoreState, updateProgress } from './stats.js';
import { setGreeting, setupNavigation, setupProfile, updateStats, triggerLevelUpModal, updateXPUI, applyStaggeredEntry } from './ui.js';
import { initNotifications } from './notifications.js';

/* ===============================
   DATE HELPERS
================================ */

export function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function generateId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'id_' + Date.now() + Math.random().toString(36).substring(2, 9);
}

/* ===============================
   APP STATE (GLOBAL OWNER)
================================ */

export const AppState = {
    selectedDate: getLocalDateString(),

    habitState: JSON.parse(localStorage.getItem("habits")) || {},
    dailyHabits: JSON.parse(localStorage.getItem("dailyHabits")) || {},

    streakData: JSON.parse(localStorage.getItem("streakData")) || {
        streak: 0,
        lastDate: null,
        shields: 0
    },

    xpData: JSON.parse(localStorage.getItem("xpData")) || {
        totalXP: 0,
        lastPerfectDay: null,
        lastStreakMilestone: 0,
        currentLevel: 0
    }
};

let currentUser = null;

/* ===============================
   DOM CACHE
================================ */

export const DOM = {
    percentText: null,
    completionText: null,
    streakText: null,
    shieldText: null,
    taskContainer: null
};

function cacheDOM() {
    DOM.percentText = document.querySelector(".percent");
    DOM.streakText = document.querySelectorAll(".progress-details h3")[0];
    DOM.completionText = document.querySelectorAll(".progress-details h3")[1];
    DOM.shieldText = document.querySelectorAll(".progress-details h3")[2];
    DOM.taskContainer = document.querySelector(".tasks");
}

/* ===============================
   STORAGE HELPERS (SUPABASE)
================================ */

const syncTimeouts = {};
const failedSyncs = new Set();

function showSyncError(key) {
    failedSyncs.add(key);
    const toast = document.getElementById("successToast");
    const toastMsg = document.getElementById("toastMsg");
    if (toast && toastMsg) {
        toastMsg.textContent = "Cloud sync failed. Changes saved locally.";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 4000);
    }
}

function clearSyncError(key) {
    failedSyncs.delete(key);
}

function debouncedSync(key, syncFn, delay = 1500) {
    if (syncTimeouts[key]) clearTimeout(syncTimeouts[key]);
    syncTimeouts[key] = setTimeout(async () => {
        try {
            await syncFn();
            clearSyncError(key);
        } catch (err) {
            console.error(`Background sync failed for ${key}:`, err);
            showSyncError(key);
        }
    }, delay);
}

export async function saveHabits() {
    // Always save optimistic local cache 
    localStorage.setItem("habits", JSON.stringify(AppState.habitState));

    if (currentUser) {
        debouncedSync('habits', () => syncDailyDataToSupabase(AppState.selectedDate));
    }
}

export async function saveDailyHabits() {
    // Always save optimistic local cache
    localStorage.setItem("dailyHabits", JSON.stringify(AppState.dailyHabits));

    if (currentUser) {
        debouncedSync('dailyHabits', () => syncDailyDataToSupabase(AppState.selectedDate));
    }
}

export async function syncDailyDataToSupabase(dateStr) {
    if (!currentUser || !supabase) return;

    const habitsList = AppState.dailyHabits[dateStr] || [];
    const completionStatus = {};

    habitsList.forEach(h => {
        completionStatus[h.id] = AppState.habitState[`${dateStr}_${h.id}`] || false;
    });

    try {
        const { error } = await supabase
            .from('daily_habits')
            .upsert({
                user_id: currentUser.id,
                date: dateStr,
                habits: habitsList,
                completion_status: completionStatus
            }, { onConflict: 'user_id, date' });

        if (error) throw error;
    } catch (e) {
        console.error("Error syncing daily data: ", e);
        showSyncError('dailyData');
    }
}

export async function saveStreak() {
    localStorage.setItem("streakData", JSON.stringify(AppState.streakData));
    if (currentUser) {
        debouncedSync('stats', () => syncStatsToSupabase());
    }
}

export async function saveXP() {
    // Client-side XP sanity clamping (Fix #5)
    if (isNaN(AppState.xpData.totalXP)) AppState.xpData.totalXP = 0;
    AppState.xpData.totalXP = Math.max(0, Math.min(AppState.xpData.totalXP, 500000));

    localStorage.setItem("xpData", JSON.stringify(AppState.xpData));
    if (currentUser) {
        debouncedSync('stats', () => syncStatsToSupabase());
    }
}

async function syncStatsToSupabase() {
    if (!currentUser || !supabase) return;
    try {
        const userProfileStr = localStorage.getItem("userProfile");
        const userProfile = userProfileStr ? JSON.parse(userProfileStr) : { name: "User", avatarImage: null };

        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: currentUser.id,
                display_name: userProfile.name,
                avatar_url: userProfile.avatarImage,
                theme_color: userProfile.themeColor || '#FF2E63',
                total_xp: AppState.xpData.totalXP,
                streak_data: AppState.streakData,
                xp_data: AppState.xpData
            }, { onConflict: 'id' });

        if (error) throw error;
    } catch (e) {
        console.error("Error syncing stats: ", e);
        showSyncError('stats');
    }
}

export async function resetAccountData() {
    if (!currentUser || !supabase) return;

    try {
        // Clear Supabase Daily Habits
        const { error: dhErr } = await supabase
            .from('daily_habits')
            .delete()
            .eq('user_id', currentUser.id);
        if (dhErr) throw dhErr;

        // Clear Local State
        AppState.habitState = {};
        AppState.dailyHabits = {};
        AppState.streakData = {
            streak: 0,
            lastDate: null,
            shieldUsed: false,
            shieldWeekStart: null
        };
        AppState.xpData = {
            totalXP: 0,
            lastPerfectDay: null,
            lastStreakMilestone: 0,
            currentLevel: 0
        };

        // Clear workout and nutrition data
        if (AppState.workoutData) AppState.workoutData = {};
        if (AppState.nutritionData) AppState.nutritionData = {};
        if (AppState.waterData) AppState.waterData = {};

        // Sync fresh profile state to Supabase to overwrite old XP
        await saveXP();

        // Flush Local Storage keys
        localStorage.removeItem("habits");
        localStorage.removeItem("dailyHabits");
        localStorage.removeItem("streakData");
        localStorage.removeItem("xpData");
        localStorage.removeItem("workoutData");
        localStorage.removeItem("nutritionData");
        localStorage.removeItem("waterData");

        console.log("Data Reset Complete");

        // Reload page to re-initialize UI from empty state
        window.location.reload();

    } catch (error) {
        console.error("Failed to reset account data:", error);
    }
}

/* ===============================
   MIGRATION & LIVE SYNC
================================ */

export async function migrateLocalToSupabase() {
    if (!currentUser || !supabase) return;

    const localDaily = localStorage.getItem("dailyHabits");
    if (localDaily) {
        console.log("Migrating local data to Supabase...");

        const localStreak = JSON.parse(localStorage.getItem("streakData"));
        const localXp = JSON.parse(localStorage.getItem("xpData"));

        if (localStreak || localXp) {
            const userProfileStr = localStorage.getItem("userProfile");
            const userProfile = userProfileStr ? JSON.parse(userProfileStr) : { name: "User", avatarImage: null };

            await supabase.from('profiles').upsert({
                id: currentUser.id,
                display_name: userProfile.name,
                avatar_url: userProfile.avatarImage,
                theme_color: userProfile.themeColor || '#FF2E63',
                total_xp: (localXp || AppState.xpData).totalXP,
                streak_data: localStreak || AppState.streakData,
                xp_data: localXp || AppState.xpData
            }, { onConflict: 'id' });
        }

        const parsedDaily = JSON.parse(localDaily);
        const parsedHabitState = JSON.parse(localStorage.getItem("habits")) || {};

        for (const [date, habitsArray] of Object.entries(parsedDaily)) {
            let completionStateForDate = {};
            habitsArray.forEach(h => {
                completionStateForDate[h.id] = parsedHabitState[`${date}_${h.id}`] || false;
            });

            await supabase.from('daily_habits').upsert({
                user_id: currentUser.id,
                date: date,
                habits: habitsArray,
                completion_status: completionStateForDate
            }, { onConflict: 'user_id, date' });
        }

        localStorage.removeItem("dailyHabits");
        localStorage.removeItem("habits");
        localStorage.removeItem("streakData");
        localStorage.removeItem("xpData");

        if (localStreak) AppState.streakData = localStreak;
        if (localXp) AppState.xpData = localXp;
        AppState.dailyHabits = parsedDaily;
        AppState.habitState = parsedHabitState;

        console.log("Migration complete!");
    }
}

let activeChannel = null;

export async function startSupabaseListeners() {
    if (!currentUser || !supabase) return;

    if (activeChannel) {
        supabase.removeChannel(activeChannel);
    }

    activeChannel = supabase.channel('custom-all-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` },
            (payload) => {
                const data = payload.new;
                if (data) {
                    if (data.streak_data) AppState.streakData = data.streak_data;
                    if (data.xp_data) {
                        AppState.xpData = data.xp_data;
                    } else if (data.total_xp !== undefined) {
                        AppState.xpData.totalXP = data.total_xp;
                    }

                    if (window.document.getElementById("statsPage").classList.contains("active")) {
                        updateStats();
                    }
                    updateXPUI();
                }
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'daily_habits', filter: `user_id=eq.${currentUser.id}` },
            (payload) => {
                const data = payload.new;
                if (!data) return;
                const dateStr = data.date;

                AppState.dailyHabits[dateStr] = data.habits || [];
                if (data.completion_status) {
                    Object.keys(data.completion_status).forEach(id => {
                        AppState.habitState[`${dateStr}_${id}`] = data.completion_status[id];
                    });
                }

                if (AppState.selectedDate === dateStr) {
                    renderHabits();
                    restoreState();
                    updateProgress();
                }
            }
        )
        .subscribe();
}

export async function fetchCurrentDateData(dateStr) {
    if (!currentUser || !supabase) return;

    try {
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (profileErr) console.error("Profile fetch error:", profileErr);

        if (profile) {
            if (profile.streak_data) AppState.streakData = profile.streak_data;
            if (profile.xp_data) {
                AppState.xpData = profile.xp_data;
            } else if (profile.total_xp !== undefined) {
                AppState.xpData.totalXP = profile.total_xp;
            }

            // Sync User Profile Details (Name, Avatar, Theme)
            let profStr = localStorage.getItem("userProfile");
            let profObj = profStr ? JSON.parse(profStr) : { name: profile.display_name || "User" };
            if (profile.display_name) profObj.name = profile.display_name;
            if (profile.avatar_url) profObj.avatarImage = profile.avatar_url;
            if (profile.theme_color) profObj.themeColor = profile.theme_color;
            localStorage.setItem("userProfile", JSON.stringify(profObj));

            // Mastery Math calculation applied immediately based on totalXP
            AppState.xpData.currentLevel = Math.min(100, Math.floor(AppState.xpData.totalXP / 365));
        }

        const { data: dailyData, error: dailyErr } = await supabase
            .from('daily_habits')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('date', dateStr)
            .maybeSingle();

        if (dailyErr) console.error("Daily data fetch error:", dailyErr);

        if (dailyData) {
            AppState.dailyHabits[dateStr] = dailyData.habits || [];
            if (dailyData.completion_status) {
                Object.keys(dailyData.completion_status).forEach(id => {
                    AppState.habitState[`${dateStr}_${id}`] = dailyData.completion_status[id];
                });
            }
        } else {
            if (!AppState.dailyHabits[dateStr]) AppState.dailyHabits[dateStr] = [];
        }

        // Render initially
        if (AppState.selectedDate === dateStr) {
            // Apply loaded theme settings immediately
            if (typeof window.loadProfile === 'function') {
                window.loadProfile();
            }
            renderHabits();
            restoreState();
            updateProgress();
            updateStats();
            updateXPUI();

            // Trigger Antigravity Initial Entry Application
            if (typeof applyStaggeredEntry === 'function') {
                applyStaggeredEntry();
            }
        }
    } catch (e) {
        console.error("Error fetching date data:", e);
    }
}

/* ===============================
   WORKOUT & NUTRITION CLOUD SYNC (Fix #3)
================================ */

export async function saveWorkoutData() {
    localStorage.setItem("workoutData", JSON.stringify(AppState.workoutData || {}));
    if (currentUser) {
        debouncedSync('workout', () => syncWorkoutToSupabase());
    }
}

export async function saveNutritionData() {
    localStorage.setItem("nutritionData", JSON.stringify(AppState.nutritionData || {}));
    localStorage.setItem("waterData", JSON.stringify(AppState.waterData || {}));
    if (currentUser) {
        debouncedSync('nutrition', () => syncNutritionToSupabase());
    }
}

async function syncWorkoutToSupabase() {
    if (!currentUser || !supabase) return;
    const today = getLocalDateString();
    const todayWorkouts = (AppState.workoutData || {})[today] || [];

    try {
        const { error } = await supabase
            .from('workouts')
            .upsert({
                user_id: currentUser.id,
                date: today,
                exercises: todayWorkouts
            }, { onConflict: 'user_id, date' });

        if (error) throw error;
    } catch (e) {
        console.error("Error syncing workout data:", e);
        showSyncError('workout');
    }
}

async function syncNutritionToSupabase() {
    if (!currentUser || !supabase) return;
    const today = getLocalDateString();
    const todayMeals = (AppState.nutritionData || {})[today] || [];
    const todayWater = (AppState.waterData || {})[today] || 0;

    try {
        const { error } = await supabase
            .from('nutrition_logs')
            .upsert({
                user_id: currentUser.id,
                date: today,
                meals: todayMeals,
                water_glasses: todayWater
            }, { onConflict: 'user_id, date' });

        if (error) throw error;
    } catch (e) {
        console.error("Error syncing nutrition data:", e);
        showSyncError('nutrition');
    }
}

/* ===============================
   DATA PRUNING (Fix #6)
================================ */

function pruneLocalStorage() {
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - 30);
    const cutoffStr = getLocalDateString(cutoffDate);

    // Prune habitState keys older than 30 days
    let pruned = 0;
    for (const key of Object.keys(AppState.habitState)) {
        const dateStr = key.split('_')[0];
        if (dateStr < cutoffStr) {
            delete AppState.habitState[key];
            pruned++;
        }
    }

    // Prune dailyHabits older than 30 days (keep in Supabase)
    for (const dateStr of Object.keys(AppState.dailyHabits)) {
        if (dateStr < cutoffStr) {
            delete AppState.dailyHabits[dateStr];
            pruned++;
        }
    }

    // Prune workoutData older than 30 days
    if (AppState.workoutData) {
        for (const dateStr of Object.keys(AppState.workoutData)) {
            if (dateStr < cutoffStr) {
                delete AppState.workoutData[dateStr];
                pruned++;
            }
        }
    }

    // Prune nutritionData older than 30 days
    if (AppState.nutritionData) {
        for (const dateStr of Object.keys(AppState.nutritionData)) {
            if (dateStr < cutoffStr) {
                delete AppState.nutritionData[dateStr];
                pruned++;
            }
        }
    }

    if (pruned > 0) {
        console.log(`Pruned ${pruned} old local entries (>30 days)`);
        localStorage.setItem("habits", JSON.stringify(AppState.habitState));
        localStorage.setItem("dailyHabits", JSON.stringify(AppState.dailyHabits));
        if (AppState.workoutData) localStorage.setItem("workoutData", JSON.stringify(AppState.workoutData));
        if (AppState.nutritionData) localStorage.setItem("nutritionData", JSON.stringify(AppState.nutritionData));
    }
}

/* ===============================
   SYNC RETRY ON RECONNECT (Fix #7)
================================ */

window.addEventListener('online', () => {
    if (currentUser && failedSyncs.size > 0) {
        console.log("Back online. Retrying failed syncs...");
        const toast = document.getElementById("successToast");
        const toastMsg = document.getElementById("toastMsg");
        if (toast && toastMsg) {
            toastMsg.textContent = "Back online. Syncing...";
            toast.classList.add("show");
            setTimeout(() => toast.classList.remove("show"), 2000);
        }

        if (failedSyncs.has('habits') || failedSyncs.has('dailyHabits') || failedSyncs.has('dailyData')) {
            syncDailyDataToSupabase(AppState.selectedDate);
        }
        if (failedSyncs.has('stats')) {
            syncStatsToSupabase();
        }
        if (failedSyncs.has('workout')) {
            syncWorkoutToSupabase();
        }
        if (failedSyncs.has('nutrition')) {
            syncNutritionToSupabase();
        }
        failedSyncs.clear();
    }
});

// Flush pending debounced syncs before page unload
window.addEventListener('beforeunload', () => {
    for (const key of Object.keys(syncTimeouts)) {
        if (syncTimeouts[key]) {
            clearTimeout(syncTimeouts[key]);
        }
    }
    // Use sendBeacon for critical data if possible
    if (currentUser && navigator.sendBeacon) {
        // Save current state to localStorage as a safety net
        localStorage.setItem("habits", JSON.stringify(AppState.habitState));
        localStorage.setItem("dailyHabits", JSON.stringify(AppState.dailyHabits));
        localStorage.setItem("streakData", JSON.stringify(AppState.streakData));
        localStorage.setItem("xpData", JSON.stringify(AppState.xpData));
        if (AppState.workoutData) localStorage.setItem("workoutData", JSON.stringify(AppState.workoutData));
        if (AppState.nutritionData) localStorage.setItem("nutritionData", JSON.stringify(AppState.nutritionData));
        if (AppState.waterData) localStorage.setItem("waterData", JSON.stringify(AppState.waterData));
    }
});

/* ===============================
   GAMIFICATION MATH ENGINE
================================ */

export function calculateGamification() {
    let xp = AppState.xpData.totalXP || 0;

    // Safety check just in case xp became NaN
    if (isNaN(xp)) xp = 0;

    const level = Math.floor(xp / 365);

    let rank = "[THE INITIATE]";
    if (level >= 11 && level <= 20) rank = "[THE PERSISTENT]";
    else if (level >= 21 && level <= 30) rank = "[THE WARRIOR]";
    else if (level >= 31 && level <= 40) rank = "[THE ARCHITECT]";
    else if (level >= 41 && level <= 50) rank = "[THE COMMANDANT]";
    else if (level >= 51 && level <= 60) rank = "[THE OVERLORD]";
    else if (level >= 61 && level <= 70) rank = "[THE LEGENDARY]";
    else if (level >= 71 && level <= 80) rank = "[THE MYTHIC]";
    else if (level >= 81 && level <= 99) rank = "[THE DEMIGOD]";
    else if (level >= 100) rank = "[THE IMMORTAL]";

    const isLevelUp = level > AppState.xpData.currentLevel;
    if (isLevelUp) {
        AppState.xpData.currentLevel = level;
        saveXP();
        triggerLevelUpModal(level, rank);
    }

    return { level, rank, xp };
}

/* ===============================
   APP INITIALIZATION
================================ */

document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ HabitOS Started");

    cacheDOM();
    setGreeting();
    generateWeek();
    initializeHabits();
    restoreState();
    updateProgress();
    setupNavigation();
    setupAddHabitModal();
    setupEditHabitModal();
    setupDeleteHabitModal();
    setupProfile();
    initNotifications();

    // Prune old local data to prevent unbounded growth (Fix #6)
    pruneLocalStorage();

    // Register service worker for PWA support (Fix #8)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(() => {
            console.log("Service Worker registered");
        }).catch(err => {
            console.log("Service Worker registration failed:", err);
        });
    }

    if (supabase) {
        let isInitialLoad = true;

        onAuthStateChange(async (event, session) => {
            const globalLoader = document.getElementById("globalLoader");
            const loginScreen = document.getElementById("loginScreen");
            const mainApp = document.querySelector(".app:not(.login-screen)");

            if (session && session.user) {
                currentUser = session.user;
                console.log("Supabase User detected:", currentUser.email || currentUser.id);

                // Hide Loading/Login bounds
                const bentoCard = document.getElementById("loginCard");
                const shatterCanvas = document.getElementById("shatterCanvas");
                const loginScreen = document.getElementById("loginScreen");
                const authModal = document.getElementById("authModal");
                const portalLoading = document.getElementById("portalLoading");
                const mainApp = document.querySelector(".app:not(.login-screen)");

                if (portalLoading) portalLoading.style.display = "none";
                if (authModal) authModal.style.display = "none";
                if (shatterCanvas) shatterCanvas.style.display = "none";

                // Hide global loader if this is the first paint
                if (isInitialLoad && globalLoader) {
                    gsap.to(globalLoader, {
                        opacity: 0,
                        duration: 0.6,
                        ease: "power2.inOut",
                        onComplete: () => globalLoader.style.display = "none"
                    });
                    isInitialLoad = false;
                }

                if (loginScreen && loginScreen.style.display !== "none") {
                    if (bentoCard) bentoCard.style.opacity = "0";
                    setTimeout(() => {
                        if (loginScreen) loginScreen.style.display = "none";
                        if (mainApp) {
                            mainApp.style.display = "block";
                            // Optional: fade app in
                            gsap.fromTo(mainApp, { opacity: 0 }, { opacity: 1, duration: 0.5 });
                        }
                    }, 500);
                } else if (mainApp && mainApp.style.display === "none") {
                    if (mainApp) {
                        mainApp.style.display = "block";
                        gsap.fromTo(mainApp, { opacity: 0 }, { opacity: 1, duration: 0.5 });
                    }
                }

                // Auth is established. Do migrations and loading.
                import("./ui.js").then(({ userProfile, loadProfile }) => {
                    userProfile.name = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || "User";
                    userProfile.avatarImage = currentUser.user_metadata?.avatar_url || null;
                    userProfile.avatarText = userProfile.name.charAt(0).toUpperCase();
                    localStorage.setItem("userProfile", JSON.stringify(userProfile));
                    loadProfile();
                });

                await migrateLocalToSupabase();
                await fetchCurrentDateData(AppState.selectedDate);
                startSupabaseListeners();

            } else {
                console.log("No Supabase user signed in.");
                currentUser = null;

                if (isInitialLoad && globalLoader) {
                    gsap.to(globalLoader, {
                        opacity: 0,
                        duration: 0.6,
                        ease: "power2.inOut",
                        onComplete: () => globalLoader.style.display = "none"
                    });
                    isInitialLoad = false;
                }

                if (loginScreen) {
                    loginScreen.style.display = "flex";
                    // If returning from logged out state, animate the card back
                    const bentoCard = document.getElementById("loginCard");
                    if (bentoCard) {
                        gsap.fromTo(bentoCard,
                            { scale: 0.8, opacity: 0 },
                            { scale: 1, opacity: 1, duration: 0.8, ease: "elastic.out(1, 0.4)" }
                        );
                    }
                }
                if (mainApp) {
                    mainApp.style.display = "none";
                }
            }
        });
    }
});