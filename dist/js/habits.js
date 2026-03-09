import { AppState, DOM, saveHabits, saveDailyHabits, saveXP, getLocalDateString, generateId } from './main.js';
import { restoreState, updateProgress } from './stats.js';
import { updateXPUI } from './ui.js';
import { escapeHTML, sanitizeInput } from '../utils/storage.js';

/* ===============================
   ICON DETECTION
================================ */

const iconMap = {
    "book-open": ["read", "book", "reading", "novel", "literature", "study", "learning"],
    "dumbbell": ["workout", "exercise", "gym", "fitness", "lift", "strength", "training", "muscle"],
    "activity": ["run", "jogging", "sprint", "cardio", "jog", "race", "walk", "walking", "steps", "step"],
    "moon": ["sleep", "bed", "rest", "nap", "slumber", "bedtime"],
    "heart": ["meditation", "yoga", "mindfulness", "breathe", "relax", "calm"],
    "code": ["coding", "programming", "developer", "development", "code", "python", "javascript"],
    "pen": ["write", "writing", "journal", "journaling", "essay", "article"],
    "utensils": ["cook", "cooking", "meal", "food", "kitchen", "eat", "eating"],
    "broom": ["clean", "cleaning", "tidy", "organize", "washing", "laundry"],
    "droplet": ["water", "hydrate", "hydration", "drink", "liquid"],
    "music": ["music", "sing", "singing", "instrument", "guitar", "piano", "song"],
    "globe": ["language", "learn", "french", "spanish", "german", "chinese", "japanese", "language learning"],
    "palette": ["art", "draw", "drawing", "paint", "painting", "design", "creative"],
    "gamepad-2": ["game", "gaming", "play", "video", "console"],
    "briefcase": ["work", "job", "office", "professional", "career", "business"],
    "phone": ["call", "phone", "contact", "communicate", "message"],
    "shopping-bag": ["shop", "shopping", "buy", "purchase"],
    "wallet": ["save", "money", "finance", "budget", "financial"],
    "car": ["drive", "driving", "commute", "travel"],
    "map-pin": ["trip", "vacation", "adventure", "explore", "destination"],
    "home": ["clean home", "house", "organize home"],
    "leaf": ["garden", "gardening", "plant", "planting", "nature", "outdoor"],
    "heart-pulse": ["health", "medical", "doctor", "medicine", "wellness"],
    "alarm-clock": ["wake", "wake up", "alarm", "morning", "clock", "time"],
    "cpu": ["focus", "concentration", "study session", "deep work", "productivity"],
    "coffee": ["coffee", "tea", "breakfast"],
    "check-circle": ["task", "project", "complete", "finish", "goal", "objective"]
};

export function detectHabitIcon(name) {
    const text = name.toLowerCase();

    for (const [icon, keywords] of Object.entries(iconMap)) {
        if (keywords.some(k => text.includes(k))) {
            return icon;
        }
    }
    return "check-circle";
}

export function getTasks() {
    return document.querySelectorAll(".task");
}


/* ===============================
   INITIALIZE HABITS
================================ */

export function initializeHabits() {

    const currentDay = AppState.selectedDate;

    if (!AppState.dailyHabits[currentDay]) {
        // Only load starter defaults if this is the user's very first time app use ever (no dates mapped at all)
        if (Object.keys(AppState.dailyHabits).length === 0) {
            AppState.dailyHabits[currentDay] = [
                { id: generateId(), name: "Read Book", time: "30 min", desc: "" },
                { id: generateId(), name: "Learn Python", time: "", desc: "" },
                { id: generateId(), name: "Wake up at 6", time: "", desc: "" },
                { id: generateId(), name: "Workout", time: "", desc: "" }
            ];
        } else {
            AppState.dailyHabits[currentDay] = [];
        }

        saveDailyHabits();
    }

    renderHabits();
}


/* ===============================
   RENDER HABITS
================================ */

export function renderHabits() {

    DOM.taskContainer.innerHTML = "";

    const activeHabits = AppState.dailyHabits[AppState.selectedDate] || [];

    if (activeHabits.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "habit-empty-state";

        emptyState.innerHTML = `
            <div class="habit-empty-state-icon">
                <i data-lucide="inbox"></i>
            </div>
            <div>
                <h4>No Habits Scheduled</h4>
                <p>Build your routine by adding your first habit for the day.</p>
            </div>
            <div class="habit-empty-state-actions">
                <button class="btn-add" onclick="document.getElementById('addHabitModal').classList.add('active')">
                    <i data-lucide="plus"></i> Add Habit
                </button>
                <button class="btn-clone" onclick="window.cloneYesterdayHabits()">
                    <i data-lucide="copy"></i> Clone
                </button>
            </div>`;
        DOM.taskContainer.appendChild(emptyState);
        lucide.createIcons();
        return;
    }

    activeHabits.forEach(habit => {

        const today = getLocalDateString();
        const isFuture = AppState.selectedDate > today;
        const icon = detectHabitIcon(habit.name);

        let small = "";
        if (habit.time) small += habit.time;
        if (habit.time && habit.desc) small += " • ";
        if (habit.desc) small += habit.desc;

        const task = document.createElement("div");
        task.className = "task";
        task.dataset.id = habit.id;

        task.innerHTML = `
            <div class="task-left">
            <div class="task-icon">
                <i data-lucide="${icon}"></i>
            </div>
            <div class="task-text">
                <h4>${escapeHTML(habit.name)}</h4>
                ${small ? `<small>${escapeHTML(small)}</small>` : ""}
            </div>
        </div>
            <div class="task-check" style="${isFuture ? 'opacity: 0.3; cursor: not-allowed; background: transparent;' : ''}">
                <i data-lucide="${isFuture ? 'lock' : 'check'}"></i>
            </div>
        `;

        DOM.taskContainer.appendChild(task);
        setupTaskClickHandler(task);
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Bind robust 3D card physics to dynamically injected cards
    if (typeof window.setupMagneticCards === 'function') {
        window.setupMagneticCards();
    }

    // Trigger Anti-Gravity Staggered entry when Habits boot
    if (typeof window.applyStaggeredEntry === 'function') {
        window.applyStaggeredEntry();
    }
}

/* ===============================
   CLONE YESTERDAY HABITS
================================ */

export function cloneYesterdayHabits() {
    const parts = AppState.selectedDate.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);

    // Quick pad helper
    const pad = (n) => String(n).padStart(2, "0");
    const yesterdayDateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const yesterdayHabits = AppState.dailyHabits[yesterdayDateStr];

    if (!yesterdayHabits || yesterdayHabits.length === 0) {
        alert("No habits found for yesterday to clone!");
        return;
    }

    const clonedHabits = yesterdayHabits.map(h => ({
        id: generateId(),
        name: h.name,
        time: h.time,
        desc: h.desc
    }));

    AppState.dailyHabits[AppState.selectedDate] = clonedHabits;
    saveDailyHabits();

    renderHabits();
    restoreState();
    updateProgress();
};


/* ===============================
   TASK CLICK / TOUCH
================================ */

export function setupTaskClickHandler(task) {

    let pressTimer;
    let clickTimer;
    let clickCount = 0;
    let pointerDown = false;
    let isDragging = false;
    let wasDragging = false;
    let startY = 0;
    let startX = 0;
    let currentPointerId = null;

    // Desktop Double Click
    task.addEventListener('dblclick', (e) => {
        openEditModal(task);
    });

    task.style.userSelect = "none";
    task.style.webkitUserSelect = "none";
    task.style.touchAction = "pan-y"; // Allow vertical scrolling normally

    // Prevent native drag interactions overlapping with our pointers
    task.ondragstart = () => false;

    // Disable default menu
    task.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });

    function initiateDrag() {
        if (isDragging) return;
        isDragging = true;

        if (navigator.vibrate) navigator.vibrate(50);

        task.classList.add("dragging");
        task.style.touchAction = "none"; // lock scrolling
        if (currentPointerId !== null) {
            try { task.setPointerCapture(currentPointerId); } catch (err) { }
        }

        const dustbin = document.getElementById("dustbinZone");
        if (dustbin) dustbin.classList.add("active");

        task.style.transition = 'none'; // Instant follow
    }

    task.addEventListener("pointerdown", (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return; // ignore right clicks

        pointerDown = true;
        isDragging = false;
        wasDragging = false;
        startY = e.clientY;
        startX = e.clientX;
        currentPointerId = e.pointerId;

        pressTimer = setTimeout(() => {
            if (pointerDown && !isDragging) {
                initiateDrag();
            }
        }, 800);
    });

    task.addEventListener("pointermove", (e) => {
        if (!pointerDown) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!isDragging) {
            // For mouse, immediately allow drag if moving past threshold instead of cancelling
            if (e.pointerType === 'mouse') {
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    clearTimeout(pressTimer);
                    initiateDrag();
                }
            } else {
                // For touch, movement cancels the long press
                if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
                    clearTimeout(pressTimer);
                    pointerDown = false;
                }
            }
        }

        if (isDragging) {
            // Override magnetic 3D transform with pure X/Y translation
            task.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

            const dustbin = document.getElementById("dustbinZone");
            if (dustbin) {
                const rect = dustbin.getBoundingClientRect();
                // Generous sticky hitbox
                if (e.clientX >= (rect.left - 20) && e.clientX <= (rect.right + 20) &&
                    e.clientY >= (rect.top - 20) && e.clientY <= (rect.bottom + 20)) {
                    dustbin.classList.add("drag-over");
                } else {
                    dustbin.classList.remove("drag-over");
                }
            }
        }
    });

    const handlePointerEnd = (e) => {
        clearTimeout(pressTimer);
        pointerDown = false;

        if (isDragging) {
            wasDragging = true;
            task.style.touchAction = "pan-y";
            if (currentPointerId !== null) {
                try { task.releasePointerCapture(currentPointerId); } catch (err) { }
            }

            const dustbin = document.getElementById("dustbinZone");
            let droppedOnTrash = false;

            if (dustbin) {
                const rect = dustbin.getBoundingClientRect();
                if (e.clientX >= (rect.left - 20) && e.clientX <= (rect.right + 20) &&
                    e.clientY >= (rect.top - 20) && e.clientY <= (rect.bottom + 20)) {
                    droppedOnTrash = true;
                }
                dustbin.classList.remove("active");
                dustbin.classList.remove("drag-over");
            }

            if (droppedOnTrash) {
                openDeleteConfirm(task);
            }

            // Hardware-accelerated spring back
            task.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
            task.style.transform = 'translate(0px, 0px) scale(1)';
            task.classList.remove("dragging");

            // Delay removing transition class
            setTimeout(() => {
                if (!task.classList.contains("dragging")) {
                    task.style.transition = '';
                }
            }, 500);

            isDragging = false;
            // Prevent the subsequent click event from firing completion text
            setTimeout(() => { wasDragging = false; }, 50);
        }
    };

    task.addEventListener("pointerup", handlePointerEnd);
    task.addEventListener("pointercancel", handlePointerEnd);

    task.addEventListener("click", () => {
        if (isDragging || wasDragging) return;

        clickCount++;
        if (clickCount === 1) {
            clickTimer = setTimeout(() => {
                if (clickCount === 1) {
                    toggleTaskCompletion(task);
                }
                clickCount = 0;
            }, 300); // 300ms double-tap allowance
        } else if (clickCount === 2) {
            clearTimeout(clickTimer);
            clickCount = 0;
            openEditModal(task);
        }
    });
}

export function toggleTaskCompletion(task) {
    const today = getLocalDateString();
    const isFuture = AppState.selectedDate > today;

    if (isFuture) {
        if (typeof window.showToast === 'function') {
            window.showToast("Not yet, Warrior! Plan ahead, execute today.");
        }
        return;
    }

    const isToday = AppState.selectedDate === today;

    const id = task.dataset.id;
    const key = AppState.selectedDate + "_" + id;

    const wasCompleted = task.classList.contains("completed");
    task.classList.toggle("completed");
    const isCompleted = task.classList.contains("completed");

    AppState.habitState[key] = isCompleted;
    saveHabits();

    // Gamification Core Engine 
    if (isToday) {
        const totalTasksToday = AppState.dailyHabits[AppState.selectedDate] ? AppState.dailyHabits[AppState.selectedDate].length : 1;
        const baseXP = Math.round(100 / totalTasksToday);

        if (isCompleted && !wasCompleted) {
            AppState.xpData.totalXP += baseXP;
            createSparks(task); // Visual feedback
        } else if (!isCompleted && wasCompleted) {
            AppState.xpData.totalXP = Math.max(0, AppState.xpData.totalXP - baseXP);
        }

        saveXP();
        updateXPUI();
    }

    updateProgress();
}

/* ===============================
   CRIMSON SPARKS EFFECT
================================ */
export function createSparks(taskElement) {
    const checkIcon = taskElement.querySelector('.task-check');
    if (!checkIcon) return;

    const rect = checkIcon.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < 8; i++) {
        const spark = document.createElement('div');
        spark.className = 'crimson-spark';

        // Randomize direction and distance
        const angle = (Math.PI * 2 * i) / 8 + (Math.random() * 0.5 - 0.25);
        const distance = 25 + Math.random() * 20;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        spark.style.left = `${centerX}px`;
        spark.style.top = `${centerY}px`;
        spark.style.setProperty('--tx', `${tx}px`);
        spark.style.setProperty('--ty', `${ty}px`);

        document.body.appendChild(spark);

        // Cleanup
        setTimeout(() => spark.remove(), 600);
    }
}


/* ===============================
   ADD HABIT
================================ */

export function setupAddHabitModal() {

    const modal = document.getElementById("addHabitModal");
    const form = document.getElementById("habitForm");

    document
        .getElementById("addHabitBtn")
        .onclick = () => {
            modal.classList.add("active");
            if (typeof window.requestNotificationPermission === "function") {
                window.requestNotificationPermission();
            }
        };

    const close = () => {
        modal.classList.remove("active");
        form.reset();
    };

    document
        .getElementById("cancelBtn").onclick = close;

    document
        .getElementById("closeModalBtn").onclick = close;

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = sanitizeInput(
            document.getElementById("habitName").value, 100);

        const time =
            document.getElementById("habitTime").value;

        const desc = sanitizeInput(
            document.getElementById("habitDesc").value, 300);

        if (!name) {
            alert("Please enter a habit name.");
            return;
        }

        // Check for duplicate habit names on the same day
        const existingHabits = AppState.dailyHabits[AppState.selectedDate] || [];
        if (existingHabits.some(h => h.name.toLowerCase() === name.toLowerCase())) {
            if (!confirm(`"${name}" already exists for this day. Add it anyway?`)) {
                return;
            }
        }

        if (!AppState.dailyHabits[AppState.selectedDate]) {
            AppState.dailyHabits[AppState.selectedDate] = [];
        }

        AppState.dailyHabits[AppState.selectedDate].push({
            id: generateId(),
            name,
            time,
            desc
        });

        saveDailyHabits();

        renderHabits();
        restoreState();
        updateProgress();

        close();
    });
}


/* ===============================
   EDIT HABIT
================================ */

let currentEditTask = null;

export function openEditModal(task) {
    currentEditTask = task;
    const id = task.dataset.id;
    const habit = AppState.dailyHabits[AppState.selectedDate].find(h => h.id === id);

    if (habit) {
        document.getElementById("editHabitName").value = habit.name;
        document.getElementById("editHabitTime").value = habit.time || "";
        document.getElementById("editHabitDesc").value = habit.desc || "";

        document.getElementById("editHabitModal").classList.add("active");
    }
}

export function setupEditHabitModal() {

    const modal =
        document.getElementById("editHabitModal");

    const form =
        document.getElementById("editHabitForm");

    const close = () => {
        modal.classList.remove("active");
        currentEditTask = null;
    };

    document
        .getElementById("cancelEditBtn").onclick = close;

    document
        .getElementById("closeEditModalBtn").onclick = close;

    document.getElementById("editModalOverlay").onclick = close;

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        if (!currentEditTask) return;

        const id = currentEditTask.dataset.id;
        const habit = AppState.dailyHabits[AppState.selectedDate].find(h => h.id === id);

        if (habit) {
            habit.name = sanitizeInput(document.getElementById("editHabitName").value, 100);
            habit.time = document.getElementById("editHabitTime").value;
            habit.desc = sanitizeInput(document.getElementById("editHabitDesc").value, 300);

            if (!habit.name) {
                alert("Habit name cannot be empty.");
                return;
            }

            saveDailyHabits();
            renderHabits();
            restoreState();
            updateProgress();
            close();
        }
    });
}


/* ===============================
   DELETE HABIT
================================ */

let currentDeleteTask = null;

export function openDeleteConfirm(task) {
    currentDeleteTask = task;

    // Populate the Habit name in the UI
    const id = task.dataset.id;
    const habit = AppState.dailyHabits[AppState.selectedDate].find(h => h.id === id);
    if (habit) {
        document.getElementById("deleteHabitName").textContent = habit.name;
    }

    document
        .getElementById("deleteHabitModal")
        .classList.add("active");
}

export function setupDeleteHabitModal() {

    const modal = document.getElementById("deleteHabitModal");

    const close = () => {
        modal.classList.remove("active");
        currentDeleteTask = null;
    };

    document.getElementById("cancelDeleteBtn").onclick = close;
    document.getElementById("closeDeleteModalBtn").onclick = close;
    document.getElementById("deleteModalOverlay").onclick = close;

    document
        .getElementById("confirmDeleteBtn")
        .onclick = () => {

            if (!currentDeleteTask) return;

            const id =
                currentDeleteTask.dataset.id;
            const habit = AppState.dailyHabits[AppState.selectedDate].find(h => h.id === id);

            // Subtract XP if deleted habit was completed TODAY
            const today = getLocalDateString();
            const isToday = AppState.selectedDate === today;
            const key = AppState.selectedDate + "_" + id;
            const isCompleted = AppState.habitState[key];

            if (isToday && isCompleted) {
                const totalTasksToday = AppState.dailyHabits[AppState.selectedDate].length;
                const baseXP = Math.round(100 / totalTasksToday);
                AppState.xpData.totalXP = Math.max(0, AppState.xpData.totalXP - baseXP);
                saveXP();
                if (typeof window.updateXPUI === "function") {
                    window.updateXPUI();
                }
            }

            // Filter out of state
            AppState.dailyHabits[AppState.selectedDate] =
                AppState.dailyHabits[AppState.selectedDate]
                    .filter(h => h.id !== id);

            // Clean up habitState completion
            delete AppState.habitState[key];
            saveHabits();

            saveDailyHabits();

            renderHabits();
            restoreState();
            updateProgress();

            close();
        };
}

// Bind for inline HTML calls
window.cloneYesterdayHabits = cloneYesterdayHabits;

// Context Menu removed in favor of Drag-to-Delete and Double-Tap-to-Edit gestures.