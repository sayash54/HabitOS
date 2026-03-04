import { AppState, DOM, saveXP, saveStreak, getLocalDateString } from './main.js';
import { getTasks, initializeHabits } from './habits.js';

/* ===============================
   RESTORE SAVED STATE
================================ */

export function restoreState() {

    getTasks().forEach(task => {

        const id = task.dataset.id;

        const key =
            AppState.selectedDate + "_" + id;

        if (AppState.habitState[key]) {
            task.classList.add("completed");
        } else {
            task.classList.remove("completed");
        }

    });
}


/* ===============================
   PROGRESS CALCULATION
================================ */

export function updateProgress() {

    const total = getTasks().length;

    const completed =
        document.querySelectorAll(
            ".task.completed"
        ).length;

    const percent =
        total === 0
            ? 0
            : Math.round((completed / total) * 100);

    if (DOM.percentText) {
        if (typeof window.countTo === 'function') {
            window.countTo(DOM.percentText, percent, 1500, "", "%");
        } else {
            DOM.percentText.textContent = percent + "%";
        }
    }

    if (DOM.completionText)
        DOM.completionText.textContent =
            `${completed} / ${total} Tasks`;

    updateStreak(percent);
    updateRing(percent);
}


/* ===============================
   STREAK ENGINE
================================ */

export function updateStreak(percent) {

    const streak = AppState.streakData;

    const now = new Date();
    const today = getLocalDateString(now);

    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterday = getLocalDateString(yesterdayDate);

    // WEEK RESET
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - now.getDay());
    const weekStart = getLocalDateString(weekStartDate);

    if (streak.shieldWeekStart !== weekStart) {
        streak.shieldWeekStart = weekStart;
        streak.shieldUsed = false;
    }


    // PERFECT DAY
    if (percent === 100) {

        if (streak.lastDate !== today) {

            if (streak.lastDate === yesterday)
                streak.streak++;
            else
                streak.streak = 1;

            streak.lastDate = today;
        }

        // Gamification: Perfect Day XP (+25) - ONLY FOR TODAY
        if (AppState.selectedDate === today && AppState.xpData.lastPerfectDay !== today) {
            AppState.xpData.totalXP += 25;
            AppState.xpData.lastPerfectDay = today;
            window.saveXP();
        }

        // Gamification: Weekly Consistency Milestone (+100) & +1 Shield
        if (streak.streak > 0 && streak.streak % 7 === 0) {
            if (AppState.xpData.lastStreakMilestone !== streak.streak) {
                AppState.xpData.totalXP += 100;
                AppState.xpData.lastStreakMilestone = streak.streak;

                if (typeof streak.shields === 'undefined') streak.shields = 0;
                streak.shields++;
                console.log(`🛡 Shield Earned! Total: ${streak.shields}`);

                window.saveXP();
            }
        }

        // Aura State styling on container
        document.querySelector('.app-container')?.classList.add('aura-breathing');

    }

    // GOOD DAY
    else if (percent >= 75) {

        if (streak.lastDate !== today)
            streak.lastDate = today;

        document.querySelector('.app-container')?.classList.remove('aura-breathing');
    }

    // BAD DAY
    else {

        if (streak.lastDate === today) {

            if (typeof streak.shields === 'undefined') streak.shields = 0;

            if (streak.shields > 0) {
                streak.shields--;
                console.log(`🛡 Shield Used! Remaining: ${streak.shields}`);
            } else {
                streak.streak = 0;
                console.log("💔 Streak Broken");
            }
        }

        document.querySelector('.app-container')?.classList.remove('aura-breathing');
    }

    saveStreak();

    if (DOM.streakText) {
        DOM.streakText.textContent =
            streak.streak + " Days";
    }

    if (DOM.shieldText) {
        if (typeof streak.shields === 'undefined') streak.shields = 0;
        DOM.shieldText.textContent = streak.shields;
    }
}


/* ===============================
   PROGRESS RING
================================ */

export function updateRing(percent) {

    const circle =
        document.querySelector(".progress");

    const ring =
        document.querySelector(".progress-ring");

    if (!circle) return;

    const radius = 52;
    const circumference =
        2 * Math.PI * radius;

    const offset =
        circumference -
        (percent / 100) * circumference;

    // Apply the offset value
    // The CSS will-change and transition engine will take over to render this at 60fps
    circle.style.strokeDasharray =
        circumference;

    circle.style.strokeDashoffset =
        offset;
}


/* ===============================
   WEEK STRIP
================================ */

export function generateWeek() {

    const container =
        document.getElementById(
            "weekStrip"
        );

    const days =
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const today = new Date();

    const weekStart = new Date(today);
    weekStart.setDate(
        today.getDate() - today.getDay()
    );

    container.innerHTML = "";

    for (let i = 0; i < 7; i++) {

        const d = new Date(weekStart);
        d.setDate(
            weekStart.getDate() + i
        );

        const dateStr = getLocalDateString(d);

        const active =
            dateStr ===
                AppState.selectedDate
                ? "active"
                : "";

        container.innerHTML += `
        <div class="day ${active}"
        onclick="selectDay('${dateStr}')">
            ${days[d.getDay()]}<br>
            ${d.getDate()}
        </div>`;
    }
}


/* ===============================
   DAY SWITCH
================================ */

export function selectDay(date) {

    AppState.selectedDate = date;

    generateWeek();
    initializeHabits();
    restoreState();
    updateProgress();
}

// Bind for inline HTML calls
window.selectDay = selectDay;