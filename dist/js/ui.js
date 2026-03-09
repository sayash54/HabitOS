import { AppState, getLocalDateString, calculateGamification, resetAccountData } from './main.js';
import { supabase } from './supabase-config.js';
import { escapeHTML } from '../utils/storage.js';

/* ===============================
   UI LOCAL STATE
================================ */

let reviewCurrentDate = new Date();
let selectedDayForReview = null;
let monthNavSetup = false;


/* ===============================
   GREETING
================================ */

export function setGreeting() {

    const greeting =
        document.getElementById("greeting");

    const hour = new Date().getHours();

    greeting.textContent =
        hour < 12 ? "Good Morning" :
            hour < 17 ? "Good Afternoon" :
                hour < 21 ? "Good Evening" :
                    "Good Night";
}


/* ===============================
   NAVIGATION
================================ */

export function setupNavigation() {
    const week = document.querySelector(".week");
    const progress = document.querySelector(".progress-card");
    const tasks = document.querySelector(".tasks");
    const statsPage = document.getElementById("statsPage");
    const reviewPage = document.getElementById("reviewPage");
    const fab = document.getElementById("addHabitBtn");
    const mainAppWrapper = document.querySelector(".app");

    // Add Home Button to Header
    const homeBtn = document.createElement("button");
    homeBtn.className = "profile";
    homeBtn.innerHTML = `<i data-lucide="home"></i>`;
    homeBtn.style.display = "none";
    homeBtn.id = "homeNavBtn";

    const headerActions = document.querySelector(".header-actions");
    if (headerActions && !document.getElementById("homeNavBtn")) {
        headerActions.insertBefore(homeBtn, headerActions.firstChild);
    }

    function switchView(viewName) {
        mainAppWrapper.classList.add("blur-exit");

        setTimeout(() => {
            const home = viewName === 'home';
            const stats = viewName === 'stats';
            const review = viewName === 'review';

            week.style.display = home ? "flex" : "none";
            progress.style.display = home ? "flex" : "none";
            tasks.style.display = home ? "grid" : "none";
            fab.style.display = home ? "block" : "none";

            const bellBtn = document.getElementById("bellBtn");
            if (bellBtn) bellBtn.style.display = home ? "flex" : "none";

            const homeBtnRef = document.getElementById("homeNavBtn");
            if (homeBtnRef) homeBtnRef.style.display = home ? "none" : "flex";

            statsPage.classList.toggle("active", stats);
            reviewPage.classList.toggle("active", review);

            if (stats) updateStats();
            if (review) setupReviewTab();

            if (!home && typeof closeProfileDropdown === "function") {
                closeProfileDropdown();
            }

            mainAppWrapper.classList.remove("blur-exit");
            applyStaggeredEntry();

        }, 150);
    }

    // Bind new Menu Buttons
    const statBtn = document.getElementById("navStatsBtn");
    const revBtn = document.getElementById("navReviewBtn");
    const hBtn = document.getElementById("homeNavBtn");

    if (statBtn) statBtn.onclick = () => switchView('stats');
    if (revBtn) revBtn.onclick = () => switchView('review');
    if (hBtn) hBtn.onclick = () => switchView('home');

    // Initialize Bottom Nav logic
    setupBottomNav();
}

/* ===============================
   BOTTOM NAVIGATION BAR LOGIC
================================ */

function setupBottomNav() {
    const navItems = document.querySelectorAll('.z-nav-item');
    const sections = document.querySelectorAll('.z-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Already active? Do nothing.
            if (item.classList.contains('active')) return;

            // Disable clicks temporarily during animation
            navItems.forEach(nav => nav.style.pointerEvents = 'none');

            // Find currently active section
            const currentActiveSection = document.querySelector('.z-section.active');

            // Remove active state from all nav buttons & add to clicked
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);

            if (currentActiveSection) {
                // Add fade-out animation to current section
                currentActiveSection.classList.add('fade-out');

                // Wait for fade-out to complete (matching CSS 0.3s)
                setTimeout(() => {
                    sections.forEach(sec => {
                        sec.classList.remove('active');
                        sec.classList.remove('fade-out');
                    });

                    showTargetSection(targetId, targetSection);
                    // Re-enable clicks
                    navItems.forEach(nav => nav.style.pointerEvents = 'auto');
                }, 300);
            } else {
                showTargetSection(targetId, targetSection);
                navItems.forEach(nav => nav.style.pointerEvents = 'auto');
            }
        });
    });
}

function showTargetSection(targetId, targetSection) {
    if (targetSection) {
        targetSection.classList.add('active');

        // Specific logic for Habits tab: ensure week strip and fab are correct
        const isHabits = targetId === 'nav-habits';
        const fab = document.getElementById('addHabitBtn');
        if (fab) fab.style.display = isHabits ? 'block' : 'none';

        // Specific logic for Workout Tab
        if (targetId === 'nav-workout' && window.renderWorkouts) {
            window.renderWorkouts();
        }

        // Specific logic for Profile Tab
        if (targetId === 'nav-profile') {
            updateMainProfile();
            updateMainStats();
            updateMainWeeklyReview();
        }

        // Specific logic for Nutrition Tab
        if (targetId === 'nav-nutrition' && window.renderNutrition) {
            window.renderNutrition();
        }

        // Specific logic for Settings Tab
        if (targetId === 'nav-settings' && !window.settingsInitialized) {
            setupSettingsTab();
            window.settingsInitialized = true;
        }

        // Re-trigger stagger animation for any bento cards inside this specific section
        applyStaggeredEntry();
    }
}

/* ===============================
   STAGGERED ENTRY ANIMATION
================================ */
export function applyStaggeredEntry() {
    // Select all primary Bento cards currently visible in the DOM
    const cards = document.querySelectorAll('.task, .stat-card, .progress-card');

    let visibleIndex = 0;

    requestAnimationFrame(() => {
        cards.forEach(card => {
            // Only stagger animate cards that are actually displayed on the current tab
            if (card.closest('.stats-page') && !card.closest('.stats-page.active')) return;
            if (card.closest('.review-page') && !card.closest('.review-page.active')) return;
            if (card.closest('.tasks') && document.querySelector('.tasks').style.display === 'none') return;
            if (card.classList.contains('progress-card') && document.querySelector('.progress-card').style.display === 'none') return;

            // Reset animation
            card.classList.remove('stagger-enter');
            void card.offsetWidth; // Trigger DOM reflow to restart animation sequence

            card.style.animationDelay = `${visibleIndex * 0.08}s`;
            card.classList.add('stagger-enter');
            visibleIndex++;
        });
    });
};


/* ===============================
   STATS PAGE
================================ */

export function updateStats() {

    let totalUniqueHabits = new Set();
    Object.values(AppState.dailyHabits).forEach(day => {
        day.forEach(h => totalUniqueHabits.add(h.name));
    });

    document.getElementById("totalHabits")
        .textContent = totalUniqueHabits.size;

    document.getElementById("streakCount")
        .textContent =
        AppState.streakData.streak;

    document.getElementById("streakDate")
        .textContent =
        AppState.streakData.lastDate || "No activity";


    let total = 0;
    let completed = 0;

    Object.values(AppState.habitState)
        .forEach(v => {
            total++;
            if (v) completed++;
        });

    const rate =
        total
            ? Math.round((completed / total) * 100)
            : 0;

    document.getElementById("completionRate")
        .textContent = rate + "%";

    updateWeeklyStats();
}


/* ===============================
   WEEKLY GRAPH
================================ */

function updateWeeklyStats() {

    const container =
        document.getElementById("weekBars");

    container.innerHTML = "";

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());

    for (let i = 0; i < 7; i++) {

        const d = new Date(start);
        d.setDate(start.getDate() + i);

        const dateStr = getLocalDateString(d);

        const habitsForDate = AppState.dailyHabits[dateStr] || [];

        let done = 0;

        habitsForDate
            .forEach(h => {
                if (
                    AppState.habitState[
                    dateStr + "_" + h.id
                    ]
                ) done++;
            });

        const total = habitsForDate.length;

        const percent =
            total ? done / total * 100 : 0;

        const bar = document.createElement("div");

        bar.className = "bar-item";

        bar.innerHTML = `
        <div class="bar"
        style="height:${Math.max(8, percent)}px"></div>
        <span>${d.toLocaleDateString(
            "en",
            { weekday: "short" }
        )}</span>`;

        container.appendChild(bar);
    }
}


/* ===============================
   REVIEW TAB
================================ */

export function setupReviewTab() {

    reviewCurrentDate = new Date();
    generateCalendar();

    if (!monthNavSetup) {
        setupMonthNavigation();
        setupDayStatsClose();
        monthNavSetup = true;
    }
}


function getDayCompletion(date) {

    let completed = 0;
    const habitsForDate = AppState.dailyHabits[date] || [];

    habitsForDate.forEach(h => {
        if (
            AppState.habitState[
            date + "_" + h.id
            ]
        ) completed++;
    });

    const total = habitsForDate.length;

    return {
        completed,
        total,
        percent:
            total
                ? completed / total * 100
                : 0
    };
}


function generateCalendar() {

    const grid =
        document.getElementById("calendarGrid");

    const title =
        document.getElementById("monthYear");

    grid.innerHTML = "";

    const m = reviewCurrentDate.getMonth();
    const y = reviewCurrentDate.getFullYear();

    title.textContent =
        reviewCurrentDate
            .toLocaleDateString(
                "en",
                { month: "long", year: "numeric" }
            );

    const first =
        new Date(y, m, 1).getDay();

    const days =
        new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < first; i++)
        grid.appendChild(
            document.createElement("div")
        );

    for (let d = 1; d <= days; d++) {

        const date =
            `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

        const { completed, total } = getDayCompletion(date);

        const cell = document.createElement("div");
        cell.className = "calendar-day";

        if (date === getLocalDateString()) {
            cell.classList.add("active");
        }

        cell.innerHTML = `
        <div>${d}</div>
        <small>${completed}/${total}</small>
        `;

        cell.onclick =
            () => showDayStats(date);

        grid.appendChild(cell);
    }
}


function setupMonthNavigation() {
    document.getElementById("prevMonth").onclick = () => {
        reviewCurrentDate.setMonth(reviewCurrentDate.getMonth() - 1);
        generateCalendar();
    };
    document.getElementById("nextMonth").onclick = () => {
        reviewCurrentDate.setMonth(reviewCurrentDate.getMonth() + 1);
        generateCalendar();
    };
}

function setupDayStatsClose() {
    document.getElementById("closeDayStats").onclick = () => {
        document.getElementById("dayStats").style.display = "none";
    };
}

function showDayStats(date) {
    const { completed, total, percent } = getDayCompletion(date);

    // Attempt local parse for the title string to display nicer formatted date
    const dObj = new Date(date + "T00:00:00");
    const dToUse = isNaN(dObj.getTime()) ? new Date(date) : dObj;

    document.getElementById("dayStatsTitle").textContent = dToUse.toLocaleDateString("en", {
        weekday: "short", month: "short", day: "numeric"
    });

    document.getElementById("completionLabel").textContent = `${completed} of ${total} habits completed`;
    document.getElementById("completionFill").style.width = `${percent}%`;

    const list = document.getElementById("dayHabitsList");
    list.innerHTML = "";

    if (total === 0) {
        list.innerHTML = "<p style='color:var(--text-secondary);font-size:14px'>No habits found.</p>";
    }

    const habitsForDate = AppState.dailyHabits[date] || [];
    habitsForDate.forEach(h => {
        const isDone = AppState.habitState[date + "_" + h.id];

        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.padding = "10px";
        item.style.marginBottom = "8px";
        item.style.background = "var(--bg-secondary)";
        item.style.borderRadius = "8px";
        item.style.opacity = isDone ? "1" : "0.6";

        item.innerHTML = `
            <div style="margin-right:15px; color:${isDone ? 'var(--success)' : 'var(--text-secondary)'}">
                <i data-lucide="${isDone ? 'check-circle' : 'circle'}"></i>
            </div>
            <div>
                <h4 style="margin:0; font-size:14px; font-weight:500; text-decoration:${isDone ? 'line-through' : 'none'}; color:${isDone ? 'var(--text-secondary)' : 'var(--text-primary)'}">${escapeHTML(h.name)}</h4>
            </div>
        `;
        list.appendChild(item);
    });

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
    document.getElementById("dayStats").style.display = "block";
}


/* ===============================
   PROFILE SYSTEM
================================ */

export let userProfile =
    JSON.parse(
        localStorage.getItem("userProfile")
    ) || {
        name: "Yash",
        avatarColor: "#A35E47",
        avatarText: "Y",
        avatarImage: null
    };


export function setupProfile() {
    loadProfile();

    const closeAccountModalBtn = document.getElementById("closeAccountModalBtn");
    if (closeAccountModalBtn) closeAccountModalBtn.onclick = closeAccountModal;

    const closeAccountBtn = document.getElementById("closeAccountBtn");
    if (closeAccountBtn) closeAccountBtn.onclick = closeAccountModal;

    const saveAccountBtn = document.getElementById("saveAccountBtn");
    if (saveAccountBtn) saveAccountBtn.onclick = saveAccountSettings;

    const closeMyProfileBtn = document.getElementById("closeMyProfileBtn");
    const myProfileOverlay = document.getElementById("myProfileOverlay");
    if (closeMyProfileBtn) closeMyProfileBtn.onclick = closeMyProfileModal;
    if (myProfileOverlay) myProfileOverlay.onclick = closeMyProfileModal;

    const closeStatsModalBtn = document.getElementById("closeStatsModalBtn");
    const statsModalOverlay = document.getElementById("statsModalOverlay");
    if (closeStatsModalBtn) closeStatsModalBtn.onclick = closeStatsModal;
    if (statsModalOverlay) statsModalOverlay.onclick = closeStatsModal;

    const closeWeeklyReviewModalBtn = document.getElementById("closeWeeklyReviewModalBtn");
    const weeklyReviewModalOverlay = document.getElementById("weeklyReviewModalOverlay");
    if (closeWeeklyReviewModalBtn) closeWeeklyReviewModalBtn.onclick = closeWeeklyReviewModal;
    if (weeklyReviewModalOverlay) weeklyReviewModalOverlay.onclick = closeWeeklyReviewModal;

    // Dropdown Actions
    const resetBtn = document.getElementById("resetDataBtn");
    if (resetBtn) {
        resetBtn.onclick = async () => {
            if (confirm("Are you sure you want to completely erase your progress? This cannot be undone.")) {
                await resetAccountData();
            }
        };
    }

    const logoutBtn = document.getElementById("logoutBtn");
    const logoutBtnDropdown = document.getElementById("logoutBtnDropdown");

    const handleLogout = async () => {
        if (typeof supabase !== 'undefined' && supabase) {
            await supabase.auth.signOut();
        } else {
            localStorage.clear();
            window.location.reload();
        }
    };

    if (logoutBtn) logoutBtn.onclick = handleLogout;
    if (logoutBtnDropdown) logoutBtnDropdown.onclick = handleLogout;
}

export function loadProfile() {
    document.querySelector(".header h1").textContent = userProfile.name;

    // Theme injection (Global)

    if (userProfile.themeColor) {
        document.documentElement.style.setProperty('--accent', userProfile.themeColor);
        document.documentElement.style.setProperty('--accent-glow', userProfile.themeColor);
        const cleanHex = userProfile.themeColor.replace('#', '');
        if (cleanHex.length === 6) {
            document.documentElement.style.setProperty('--accent-r', parseInt(cleanHex.substring(0, 2), 16));
            document.documentElement.style.setProperty('--accent-g', parseInt(cleanHex.substring(2, 4), 16));
            document.documentElement.style.setProperty('--accent-b', parseInt(cleanHex.substring(4, 6), 16));
        }
    }

    // Header avatar
    const updateAvatarUI = (elId, isTextEl = false) => {
        const el = document.getElementById(elId);
        if (!el) return;

        if (userProfile.avatarImage) {
            el.style.background = `url(${userProfile.avatarImage})`;
            el.style.backgroundSize = "cover";
            el.style.backgroundPosition = "center";
            if (isTextEl) el.textContent = "";
        } else {
            el.style.background = userProfile.avatarColor;
            if (isTextEl) el.textContent = userProfile.avatarText;
        }
    };

    updateAvatarUI("profileBtn", true);
    updateAvatarUI("dropdownAvatar", true);
    updateAvatarUI("accountAvatarPreview", false);

    const accountTxt = document.getElementById("accountAvatarText");
    if (accountTxt) {
        accountTxt.textContent = userProfile.avatarImage ? "" : userProfile.avatarText;
    }

    // Dropdown items
    const dropName = document.getElementById("dropdownUserName");
    if (dropName) {
        dropName.textContent = userProfile.name;
    }

    if (typeof window.updateXPUI === "function") {
        updateXPUI();
    }
}

/* ===============================
   GAMIFICATION UI UPDATES & COUNTERS
================================ */

export function countTo(element, targetValue, duration = 1500, prefix = "", suffix = "") {
    if (!element) return;

    // Only animate if the element is empty or explicitly flagged to animate
    let startValue = 0;

    // Try to parse existing number if it exists to animate FROM current TO target
    const currentText = element.textContent.replace(/[^0-9]/g, '');
    if (currentText && !isNaN(parseInt(currentText))) {
        startValue = parseInt(currentText);
    }

    // Avoid re-animating if already at target
    if (startValue === targetValue) return;

    const startTime = performance.now();

    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const currentEased = easeOutExpo(progress);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * currentEased);

        element.textContent = `${prefix}${currentValue}${suffix}`;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = `${prefix}${targetValue}${suffix}`; // Snap to exact end
        }
    }

    requestAnimationFrame(update);
};

export function updateXPUI() {
    const stats = calculateGamification();

    const rankEl = document.getElementById("dropdownUserRank");
    const lvlEl = document.getElementById("dropdownLevelText");
    const xpTextEl = document.getElementById("dropdownXPText");
    const barEl = document.getElementById("dropdownXPBar");

    if (rankEl) rankEl.textContent = stats.rank;

    if (lvlEl) {
        countTo(lvlEl, stats.level, 1500, "Lvl ");
    }

    const xpIntoCurrentLevel = stats.xp % 365;
    const nextLevelTarget = 365;
    const progressPercent = stats.level === 100 ? 100 : (xpIntoCurrentLevel / nextLevelTarget) * 100;

    if (xpTextEl) {
        if (stats.level === 100) {
            xpTextEl.textContent = `MAX LEVEL reached`;
        } else {
            // Count up just the left number
            countTo(xpTextEl, xpIntoCurrentLevel, 1500, "", " / 365 XP");
        }
    }

    if (barEl) {
        barEl.style.width = `${progressPercent}%`;
    }
};

export function triggerLevelUpModal(newLevel, newRank) {
    document.getElementById("levelUpNewLevel").textContent = `Level ${newLevel}`;
    document.getElementById("levelUpNewRank").textContent = newRank;

    const modal = document.getElementById("levelUpModal");
    modal.classList.add("active");

    document.getElementById("levelUpModalOverlay").onclick = () => {
        modal.classList.remove("active");
    }
};





async function openAccountModal() {
    document.getElementById("accountModal").classList.add("active");

    // Sync current profile data to the modal
    document.getElementById("userName").value = userProfile.name;
    const preview = document.getElementById("accountAvatarPreview");
    const previewText = document.getElementById("accountAvatarText");

    if (userProfile.avatarImage) {
        preview.style.background = `url(${userProfile.avatarImage})`;
        preview.style.backgroundSize = "cover";
        preview.style.backgroundPosition = "center";
        previewText.textContent = "";
    } else {
        preview.style.background = userProfile.avatarColor;
        previewText.textContent = userProfile.avatarText;
    }

    // Track active unsaved theme choices inside the modal
    let pendingThemeColor = userProfile.themeColor || "#FF2E63";

    const customPicker = document.getElementById("customColorPicker");
    if (customPicker) customPicker.value = pendingThemeColor;

    const applyLiveColor = (hex) => {
        document.documentElement.style.setProperty('--accent', hex);
        document.documentElement.style.setProperty('--accent-glow', hex);
        const cleanHex = hex.replace('#', '');
        if (cleanHex.length === 6) {
            document.documentElement.style.setProperty('--accent-r', parseInt(cleanHex.substring(0, 2), 16));
            document.documentElement.style.setProperty('--accent-g', parseInt(cleanHex.substring(2, 4), 16));
            document.documentElement.style.setProperty('--accent-b', parseInt(cleanHex.substring(4, 6), 16));
        }
    };

    // Bind Preset Bubbles
    const presets = document.querySelectorAll('.theme-preset');
    presets.forEach(pBtn => {
        // Reset borders
        pBtn.style.borderColor = pBtn.dataset.color === pendingThemeColor ? "var(--text)" : "transparent";
        if (pBtn.dataset.color === "#ffffff") pBtn.style.borderColor = "var(--border)"; // Ghost default

        pBtn.onclick = () => {
            pendingThemeColor = pBtn.dataset.color;
            if (customPicker) customPicker.value = pendingThemeColor;
            applyLiveColor(pendingThemeColor);

            presets.forEach(b => b.style.borderColor = "transparent");
            pBtn.style.borderColor = "var(--text)";

            // Fix: Update the save button's payload directly when color changes
            document.getElementById("saveAccountBtn").dataset.pendingColor = pendingThemeColor;
        }
    });

    if (customPicker) {
        customPicker.oninput = (e) => {
            pendingThemeColor = e.target.value;
            applyLiveColor(pendingThemeColor);
            presets.forEach(b => b.style.borderColor = "transparent");

            // Fix: Update the save button's payload directly when color changes
            document.getElementById("saveAccountBtn").dataset.pendingColor = pendingThemeColor;
        };
    }

    // Temporarily attach `pendingThemeColor` to the save button so it can be extracted
    document.getElementById("saveAccountBtn").dataset.pendingColor = pendingThemeColor;

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Bind Image Upload click
    preview.onclick = () => {
        document.getElementById("avatarUpload").click();
    };

    // Handle Image file selection instantly showing in preview
    document.getElementById("avatarUpload").onchange = function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (evt) {
                preview.style.background = `url(${evt.target.result})`;
                preview.style.backgroundSize = "cover";
                preview.style.backgroundPosition = "center";
                previewText.textContent = "";
                // Store temporarily on the input element for saveAccountSettings to grab
                document.getElementById("avatarUpload").dataset.base64 = evt.target.result;
            };
            reader.readAsDataURL(file);
        }
    };
}
function closeAccountModal() {
    const modal = document.getElementById("accountModal");
    modal.classList.add("closing");
    setTimeout(() => {
        modal.classList.remove("active");
        modal.classList.remove("closing");
    }, 280);
}

async function saveAccountSettings() {
    const rawName = document.getElementById("userName").value.trim();
    if (!rawName) {
        alert("Please enter a display name.");
        return;
    }

    userProfile.name = rawName;
    userProfile.avatarText = rawName.charAt(0).toUpperCase();

    // Grab newly uploaded Base64 image if it exists
    const b64 = document.getElementById("avatarUpload").dataset.base64;
    if (b64) {
        userProfile.avatarImage = b64;
    }

    const pendingColor = document.getElementById("saveAccountBtn").dataset.pendingColor;
    if (pendingColor) {
        userProfile.themeColor = pendingColor;
    }

    localStorage.setItem("userProfile", JSON.stringify(userProfile));

    // UI Updates - Do this synchronously before network requests so it feels instant
    loadProfile();
    closeAccountModal();
    showToast("Settings Saved Successfully!");

    // Fix Persistence to Cloud Database (Supabase) in background
    try {
        if (!supabase) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase.from('profiles').upsert({
                id: user.id,
                display_name: userProfile.name,
                avatar_url: userProfile.avatarImage,
                theme_color: userProfile.themeColor,
                total_xp: AppState.xpData?.totalXP || 0,
                streak_data: AppState.streakData || {},
                xp_data: AppState.xpData || {}
            }, { onConflict: 'id' });

            if (error) throw error;
            console.log("Settings successfully synced to cloud.");
        }
    } catch (err) {
        console.error("Failed to sync settings to cloud:", err.message);
    }
}

function showToast(message) {
    const toast = document.getElementById("successToast");
    const toastMsg = document.getElementById("toastMsg");
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.classList.add("show");

    // Auto-hide
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// Ensure account avatar updates get properly referenced by saving the user object
// window access is not needed if everything binds properly via setupProfile() or similar calls

export async function openMyProfileModal() {
    document.getElementById("myProfileModal").classList.add("active");

    // 1. Populate Avatar & Name
    const avatar = document.getElementById("myProfileAvatarPreview");
    const avatarText = document.getElementById("myProfileAvatarText");
    document.getElementById("myProfileName").textContent = userProfile.name || "Warrior Name";

    // Calculate Rank Name
    const xpData = AppState.xpData || { totalXP: 0, currentLevel: 1 };
    const level = xpData.currentLevel || 1;

    const ranks = {
        1: "THE INITIATE",
        5: "THE APPRENTICE",
        10: "THE PERSISTENT",
        20: "THE RELENTLESS",
        35: "THE UNBREAKABLE",
        50: "THE MASTER",
        75: "THE LEGEND",
        100: "THE IMMORTAL"
    };

    let pRank = "THE INITIATE";
    const rankLevels = Object.keys(ranks).map(Number).sort((a, b) => b - a);
    for (let rlk of rankLevels) {
        if (level >= rlk) {
            pRank = ranks[rlk];
            break;
        }
    }
    document.getElementById("myProfileRank").textContent = `[${pRank}]`;

    if (userProfile.avatarImage) {
        avatar.style.background = `url(${userProfile.avatarImage})`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatarText.textContent = "";
    } else {
        avatar.style.background = userProfile.avatarColor || "#1a1a1a";
        avatarText.textContent = userProfile.avatarText || "Y";
    }

    // 2. Populate XP / Level
    const reqXP = typeof window.calculateXPForLevel === 'function' ? window.calculateXPForLevel(level) : (level * 100);
    const pct = Math.min(100, Math.round((xpData.totalXP / reqXP) * 100));

    document.getElementById("myProfileLevelText").textContent = `Level ${level}`;
    document.getElementById("myProfileXPText").textContent = `${xpData.totalXP} / ${reqXP} XP`;

    // Small delay to trigger CSS transition
    setTimeout(() => {
        const bar = document.getElementById("myProfileXPBar");
        if (bar) bar.style.width = `${pct}%`;
    }, 50);

    // 3. Inject Connected Account Info
    const emailText = document.getElementById("myProfileEmailText");
    const providerText = document.getElementById("myProfileProviderText");
    const providerIcon = document.getElementById("myProfileProviderIcon");

    try {
        if (typeof supabase === 'undefined' || !supabase) throw new Error("Supabase is not initialized");
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) throw error;

        if (user) {
            emailText.textContent = user.email || "No email linked";

            const provider = user.app_metadata?.provider || "email";
            providerText.textContent = `Connected via ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;

            if (provider === 'google') {
                providerIcon.setAttribute('data-lucide', 'chrome');
                providerIcon.style.color = '#ea4335';
            } else if (provider === 'github') {
                providerIcon.setAttribute('data-lucide', 'github');
                providerIcon.style.color = '#ffffff';
            } else {
                providerIcon.setAttribute('data-lucide', 'mail');
                providerIcon.style.color = 'var(--text-soft)';
            }
        } else {
            throw new Error("No user found");
        }
    } catch (err) {
        emailText.textContent = "Local Account";
        providerText.textContent = "Not synced to cloud";
        providerIcon.setAttribute('data-lucide', 'hard-drive');
        providerIcon.style.color = 'var(--text-soft)';
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

export function closeMyProfileModal() {
    document.getElementById("myProfileModal").classList.remove("active");
}

/* ===============================
   STATS MODAL
================================ */

export function openStatsModal() {
    document.getElementById("statsModal").classList.add("active");

    const xp = AppState.xpData?.totalXP || 0;
    const trueLevel = Math.floor(xp / 365);

    let totalCompleted = 0;
    for (const key in AppState.habitState) {
        if (AppState.habitState[key] === true) {
            totalCompleted++;
        }
    }

    document.getElementById("statsXPVal").textContent = xp;
    document.getElementById("statsLevelVal").textContent = trueLevel;
    document.getElementById("statsTasksVal").textContent = totalCompleted;

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

export function closeStatsModal() {
    document.getElementById("statsModal").classList.remove("active");
}

/* ===============================
   WEEKLY REVIEW MODAL
================================ */

export function openWeeklyReviewModal() {
    document.getElementById("weeklyReviewModal").classList.add("active");

    const container = document.getElementById("weeklyGraphContainer");
    container.innerHTML = ""; // Clear existing

    // Generate last 7 days dates
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const dayName = d.toLocaleDateString("en-US", { weekday: 'short' });

        // Calculate completion
        const habitsForDay = AppState.dailyHabits[dateStr] || [];
        const total = habitsForDay.length;
        let completed = 0;

        if (total > 0) {
            habitsForDay.forEach(h => {
                if (AppState.habitState[`${dateStr}_${h.id}`]) {
                    completed++;
                }
            });
        }

        const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
        days.push({ name: dayName, pct: pct });
    }

    // Render bars
    days.forEach((day, index) => {
        const col = document.createElement("div");
        col.className = "weekly-bar-col";

        const barWrapper = document.createElement("div");
        barWrapper.className = "weekly-bar-wrapper";

        const barFill = document.createElement("div");
        barFill.className = "weekly-bar-fill";
        barFill.style.transition = `height 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s`;

        const label = document.createElement("span");
        label.className = "weekly-bar-label";
        label.textContent = day.name;

        barWrapper.appendChild(barFill);
        col.appendChild(barWrapper);
        col.appendChild(label);

        container.appendChild(col);

        // Trigger animation
        setTimeout(() => {
            barFill.style.height = `${day.pct}%`;
            // Add glow if 100%
            if (day.pct === 100) {
                barFill.style.boxShadow = "0 0 15px var(--accent-glow)";
            }
        }, 50);
    });
}

export function closeWeeklyReviewModal() {
    document.getElementById("weeklyReviewModal").classList.remove("active");
}

/* ===============================
   MAGNETIC 3D BENTO CARDS
================================ */
export function setupMagneticCards() {
    const cards = document.querySelectorAll('.task, .stat-card, .progress-card');

    cards.forEach(card => {
        // Remove existing listener to prevent stacking on re-renders
        card.removeEventListener('mousemove', handleMagneticMove);
        card.removeEventListener('mouseleave', handleMagneticLeave);

        card.addEventListener('mousemove', handleMagneticMove);
        card.addEventListener('mouseleave', handleMagneticLeave);
    });
};

function handleMagneticMove(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;

    // Faster transition during active tracking (0.1s)
    card.style.transition = 'transform 0.1s ease-out';
    card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(5px)`;
}

function handleMagneticLeave(e) {
    const card = e.currentTarget;
    // Smoother springy snap back (0.4s)
    card.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    card.style.transform = `perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0px)`;
}

// Initial binding on boot
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupMagneticCards, 200);
});

/* ===============================
   BOTTOM NAV - SETTINGS TAB LOGIC
================================ */

function setupSettingsTab() {
    // 1. Load Current Data
    const userProfileStr = localStorage.getItem("userProfile");
    const userProfile = userProfileStr ? JSON.parse(userProfileStr) : { name: "Warrior", themeColor: "#ff2e63", avatarImage: null };

    document.getElementById("mainUserName").value = userProfile.name || "";

    if (userProfile.avatarImage) {
        document.getElementById("mainSettingsAvatarPreview").style.backgroundImage = `url(${userProfile.avatarImage})`;
        document.getElementById("mainSettingsAvatarText").style.display = "none";
    } else {
        document.getElementById("mainSettingsAvatarText").textContent = userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U";
        document.getElementById("mainSettingsAvatarText").style.display = "block";
    }

    // 2. Avatar Upload Binding
    const avatarPreview = document.getElementById("mainSettingsAvatarPreview");
    const avatarUpload = document.getElementById("mainAvatarUpload");

    avatarPreview.addEventListener("click", () => {
        avatarUpload.click();
    });

    avatarUpload.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                avatarPreview.style.backgroundImage = `url(${event.target.result})`;
                document.getElementById("mainSettingsAvatarText").style.display = "none";
                avatarPreview.dataset.base64 = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // 3. Theme Color Bindings
    let selectedColor = userProfile.themeColor || "#ff2e63";
    const customPicker = document.getElementById("mainCustomColorPicker");
    const presets = document.querySelectorAll(".main-theme-preset");

    customPicker.value = selectedColor;

    function activateMainThemeColor(color, noCustomUpdate = false) {
        selectedColor = color;
        // Update document variables to preview live
        document.documentElement.style.setProperty('--accent', color);

        // Convert hex to rgb for glow
        let r = parseInt(color.slice(1, 3), 16),
            g = parseInt(color.slice(3, 5), 16),
            b = parseInt(color.slice(5, 7), 16);
        document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.5)`);
        document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);

        presets.forEach(p => {
            if (p.getAttribute("data-color") === color) {
                p.style.borderColor = "white";
                p.style.transform = "scale(1.1)";
            } else {
                p.style.borderColor = p.getAttribute("data-color") === "#ffffff" ? "var(--border)" : "transparent";
                p.style.transform = "scale(1)";
            }
        });

        if (!noCustomUpdate) {
            customPicker.value = color;
        }
    }

    // Initialize UI state
    activateMainThemeColor(selectedColor);

    presets.forEach(preset => {
        preset.addEventListener('click', () => {
            activateMainThemeColor(preset.getAttribute("data-color"));
        });
    });

    customPicker.addEventListener('input', (e) => {
        activateMainThemeColor(e.target.value, true);
        // Clear preset highlights
        presets.forEach(p => {
            p.style.borderColor = p.getAttribute("data-color") === "#ffffff" ? "var(--border)" : "transparent";
            p.style.transform = "scale(1)";
        });
    });

    // 4. Save Button
    document.getElementById("mainSaveSettingsBtn").addEventListener('click', async () => {
        const newName = document.getElementById("mainUserName").value.trim() || "Warrior";
        const newAvatar = avatarPreview.dataset.base64 || userProfile.avatarImage;
        const newColor = selectedColor;

        const updatedProfile = {
            ...userProfile,
            name: newName,
            avatarImage: newAvatar,
            themeColor: newColor
        };

        localStorage.setItem("userProfile", JSON.stringify(updatedProfile));

        // Update App UI elements
        const h1 = document.querySelector(".header h1");
        if (h1) h1.textContent = newName;

        // Sync to Supabase
        const { supabase, getCurrentUser } = await import('./supabase-config.js');
        const user = getCurrentUser();

        if (user && supabase) {
            try {
                // Background sync
                supabase.from('profiles').upsert({
                    id: user.id,
                    display_name: newName,
                    avatar_url: newAvatar,
                    theme_color: newColor
                }, { onConflict: 'id' }).then(({ error }) => {
                    if (error) console.error("Cloud sync failed:", error);
                });
            } catch (err) { }
        }

        // Show toast
        if (window.showToast) window.showToast("Settings Saved", "var(--accent)");
    });

    // 5. Logout Button
    document.getElementById("mainLogoutBtn").addEventListener('click', () => {
        // Find existing logout button trigger if it exists or export function
        const authBtn = document.getElementById('logoutBtn') || document.getElementById('logoutBtnDropdown');
        if (authBtn) {
            authBtn.click();
        } else {
            // Fallback clear
            localStorage.clear();
            window.location.reload();
        }
    });
}

/* ===============================
   BOTTOM NAV - PROFILE TAB LOGIC
================================ */

function updateMainProfile() {
    const userProfileStr = localStorage.getItem("userProfile");
    const userProfile = userProfileStr ? JSON.parse(userProfileStr) : null;

    if (userProfile) {
        document.getElementById("mainProfileName").textContent = userProfile.name || "Warrior";
        if (userProfile.avatarImage) {
            document.getElementById("mainProfileAvatar").style.backgroundImage = `url(${userProfile.avatarImage})`;
            document.getElementById("mainProfileAvatarText").style.display = "none";
        } else {
            document.getElementById("mainProfileAvatarText").textContent = userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U";
            document.getElementById("mainProfileAvatarText").style.display = "block";
        }
    }

    const xp = AppState.xpData?.totalXP || 0;
    const { level, rank, xpForNext } = calculateGamification(xp);

    document.getElementById("mainProfileRank").textContent = rank.toUpperCase();
    document.getElementById("mainProfileLevelText").textContent = `Level ${level}`;
    document.getElementById("mainProfileXPText").textContent = `${xp} XP`;

    // Logic: Level Progress % = (Current XP % 365) / 365 * 100
    const levelProgressXP = xp % 365;
    const xpPercent = Math.min((levelProgressXP / 365) * 100, 100);

    const xpBar = document.getElementById("mainProfileXPBar");
    if (xpBar) xpBar.style.width = `${xpPercent}%`;
}

function updateMainStats() {
    const xp = AppState.xpData?.totalXP || 0;
    const trueLevel = Math.floor(xp / 365);

    let totalCompleted = 0;
    for (const key in AppState.habitState) {
        if (AppState.habitState[key] === true) {
            totalCompleted++;
        }
    }

    document.getElementById("mainStatsXP").textContent = xp;
    document.getElementById("mainStatsLevel").textContent = trueLevel;
    document.getElementById("mainStatsTasks").textContent = totalCompleted;

    updateBadges();
}

function updateMainWeeklyReview() {
    const container = document.getElementById("mainWeeklyGraph");
    if (!container) return;
    container.innerHTML = ""; // Clear existing

    // Generate last 7 days dates
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const dayName = d.toLocaleDateString("en-US", { weekday: 'short' });

        // Calculate completion
        const habitsForDay = AppState.dailyHabits[dateStr] || [];
        const total = habitsForDay.length;
        let completed = 0;

        if (total > 0) {
            habitsForDay.forEach(h => {
                if (AppState.habitState[`${dateStr}_${h.id}`]) {
                    completed++;
                }
            });
        }

        const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
        days.push({ name: dayName, pct: pct });
    }

    // Render bars
    days.forEach((day, index) => {
        const col = document.createElement("div");
        col.className = "weekly-bar-col";

        const barWrapper = document.createElement("div");
        barWrapper.className = "weekly-bar-wrapper rounded-bar";

        const barFill = document.createElement("div");
        barFill.className = "weekly-bar-fill rounded-bar";

        // Highlight today's bar with accent color, others with semi-transparent gray
        if (index === 6) {
            barFill.style.background = "var(--accent)";
            barFill.style.boxShadow = "0 0 10px rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.5)";
        } else {
            barFill.style.background = "rgba(255, 255, 255, 0.2)";
        }

        barFill.style.transition = `height 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s`;

        const label = document.createElement("span");
        label.className = "weekly-bar-label";
        label.textContent = day.name;

        // If today, highlight label also
        if (index === 6) {
            label.style.color = "var(--accent)";
            label.style.fontWeight = "600";
        }

        barWrapper.appendChild(barFill);
        col.appendChild(barWrapper);
        col.appendChild(label);

        container.appendChild(col);

        // Trigger animation
        setTimeout(() => {
            barFill.style.height = `${day.pct}%`;
            // Add glow if 100% and it's today
            if (day.pct === 100 && index === 6) {
                barFill.style.boxShadow = "0 0 15px var(--accent-glow)";
            }
        }, 50);
    });
}

// Function to update Badges in Trophy Room
function updateBadges() {
    const xp = AppState.xpData?.totalXP || 0;
    const trueLevel = Math.floor(xp / 365);

    // Example logic for Badge un-locking

    // Flame badge -> Level > 3
    const flameBadge = document.getElementById("badge-streak");
    if (flameBadge && trueLevel >= 3) {
        flameBadge.classList.replace("badge-locked", "badge-unlocked");
    }

    // Hydration badge -> User logged water >= 8 at least once (Simulation)
    const waterScore = parseInt(localStorage.getItem('waterCount') || 0);
    const waterBadge = document.getElementById("badge-hydration");
    if (waterBadge && waterScore >= 1) {
        waterBadge.classList.replace("badge-locked", "badge-unlocked");
    }

    // Dumbbell badge -> total workouts > 0 
    const isWorkoutDone = localStorage.getItem("zarc_workouts") ? true : false;
    const dumbbellBadge = document.getElementById("badge-iron");
    if (dumbbellBadge && isWorkoutDone) {
        dumbbellBadge.classList.replace("badge-locked", "badge-unlocked");
    }

    // Protein badge - simulated
    const proteinScore = parseFloat(localStorage.getItem("macro_prot") || 0);
    const proteinBadge = document.getElementById("badge-protein");
    if (proteinBadge && proteinScore >= 1) {
        proteinBadge.classList.replace("badge-locked", "badge-unlocked");
    }

    // Early riser
    const earlyBadge = document.getElementById("badge-early");
    // Just unlock randomly for aesthetic showcase during testing
    if (earlyBadge && trueLevel >= 0) {
        earlyBadge.classList.replace("badge-locked", "badge-unlocked");
    }
}

