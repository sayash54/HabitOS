import { AppState, getLocalDateString, saveDailyHabits } from './main.js';
import { renderHabits } from './habits.js';
import { escapeHTML } from '../utils/storage.js';

/* ===============================
   NOTIFICATION SYSTEM
================================ */

// Track notified tasks today to prevent spam
export let notifiedTasks = JSON.parse(localStorage.getItem('notifiedTasks')) || {
    date: null,
    tasks: [],
    nightlySent: false
};

let loopStarted = false;

export function initNotifications(request = false) {
    if (!("Notification" in window)) {
        alert("This browser does not support desktop notifications.");
        return;
    }

    if (Notification.permission === "granted") {
        startNotificationLoop();
    } else if (Notification.permission !== "denied" && request) {
        // Try the modern promise-based approach
        try {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    startNotificationLoop();
                    alert("✅ Notifications successfully enabled!");
                } else {
                    alert("❌ Notifications were not allowed. Current status: " + permission);
                }
            }).catch(err => {
                alert("⚠️ Error requesting notifications: " + err);
            });
        } catch (error) {
            // Fallback for older browsers
            Notification.requestPermission(function (permission) {
                if (permission === "granted") {
                    startNotificationLoop();
                    alert("✅ Notifications successfully enabled!");
                }
            });
        }
    } else if (request && Notification.permission === "denied") {
        alert("🔒 Notifications are blocked by your browser settings. You need to enable them manually in your browser's site settings.");
    }
};

export function requestNotificationPermission() {
    initNotifications(true);
}
function sendNotification(title, body) {
    if (Notification.permission === "granted") {
        new Notification(title, {
            body: body
        });
    }
}

function checkReminders() {
    const now = new Date();
    const todayStr = getLocalDateString(now);

    // Reset tracking if it's a new day
    if (notifiedTasks.date !== todayStr) {
        notifiedTasks = {
            date: todayStr,
            tasks: [],
            nightlySent: false
        };
        localStorage.setItem('notifiedTasks', JSON.stringify(notifiedTasks));
    }

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    const dailyTasks = AppState.dailyHabits[todayStr] || [];

    console.log(`[HabitOS Notifications] Checking at ${currentTimeStr}`);

    // 1. Check for Specific Task Time Reminders
    dailyTasks.forEach(task => {
        const key = todayStr + "_" + task.id;
        const isCompleted = AppState.habitState[key];

        if (task.time && !isCompleted) {
            console.log(`  -> Task: "${task.name}" | Target: ${task.time} | Match: ${task.time === currentTimeStr} | Notified: ${notifiedTasks.tasks.includes(task.id)}`);
        }

        // If task has a time, is NOT completed, matches current time, and hasn't been notified today
        if (task.time && !isCompleted && task.time === currentTimeStr && !notifiedTasks.tasks.includes(task.id)) {
            console.log(`🔔 TRIGGERING NOTIFICATION FOR: ${task.name}`);
            sendNotification("Time for your habit!", `It's time to: ${task.name}`);
            saveNotificationHistory("Time for your habit!", `It's time to: ${task.name}`);

            // Mark as notified
            notifiedTasks.tasks.push(task.id);
            localStorage.setItem('notifiedTasks', JSON.stringify(notifiedTasks));
        }
    });

    // 2. Check for 8:00 PM (20:00) Nightly Catch-up Reminder
    if (currentTimeStr === "20:00" && !notifiedTasks.nightlySent) {
        const incompleteCount = dailyTasks.filter(task => {
            const key = todayStr + "_" + task.id;
            return !AppState.habitState[key];
        }).length;

        if (incompleteCount > 0) {
            sendNotification(
                "Evening Check-in",
                `You still have ${incompleteCount} habit(s) left for today! Let's get them done. 💪`
            );
            saveNotificationHistory(
                "Evening Check-in",
                `You still have ${incompleteCount} habit(s) left for today! Let's get them done. 💪`
            );
        }

        // Mark nightly as sent (even if 0 incomplete, to avoid checking again)
        notifiedTasks.nightlySent = true;
        localStorage.setItem('notifiedTasks', JSON.stringify(notifiedTasks));
    }
}

function startNotificationLoop() {
    if (loopStarted) return;
    loopStarted = true;
    console.log("🔔 Notification loop started.");

    // Check immediately on start
    checkReminders();

    // Check every minute (60,000 ms)
    setInterval(checkReminders, 60000);
}

// --- NOTIFICATION CENTER UI LOGIC ---

export let notificationHistory = JSON.parse(localStorage.getItem('notifHistory')) || [];

function saveNotificationHistory(title, body) {
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');

    notificationHistory.unshift({
        title,
        body,
        time: timeStr,
        read: false,
        id: Date.now()
    });

    // Keep only last 50 notifications
    if (notificationHistory.length > 50) {
        notificationHistory.pop();
    }

    localStorage.setItem('notifHistory', JSON.stringify(notificationHistory));
    updateBellIconStatus();

    if (document.getElementById('notificationDropdown')?.classList.contains('active')) {
        renderNotificationPanel();
    }
}

function updateBellIconStatus() {
    const badge = document.getElementById('bellBadge');
    if (!badge) return;

    const hasUnread = notificationHistory.some(n => !n.read);
    badge.style.display = hasUnread ? 'block' : 'none';
}

export function renderNotificationPanel() {
    const historyContainer = document.getElementById('notifHistoryTab');
    const upcomingContainer = document.getElementById('notifUpcomingTab');

    if (!historyContainer || !upcomingContainer) return;

    // 1. Render History
    historyContainer.innerHTML = '';
    if (notificationHistory.length === 0) {
        historyContainer.innerHTML = '<div class="empty-state">No recent notifications</div>';
    } else {
        notificationHistory.forEach(notif => {
            const item = document.createElement('div');
            item.className = `notification-item ${notif.read ? '' : 'unread'}`;
            item.innerHTML = `
                <div class="notif-title">${escapeHTML(notif.title)}</div>
                <div class="notif-body">${escapeHTML(notif.body)}</div>
                <div class="notif-time">${escapeHTML(notif.time)}</div>
            `;
            historyContainer.appendChild(item);
        });
    }

    // 2. Render Upcoming
    upcomingContainer.innerHTML = '';
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const dailyTasks = AppState.dailyHabits[todayStr] || [];

    // Sort tasks: ones with time first, then by time, then without time
    const sortedTasks = [...dailyTasks].sort((a, b) => {
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return 0;
    });

    if (sortedTasks.length === 0) {
        upcomingContainer.innerHTML = '<div class="empty-state">No tasks scheduled for today</div>';
    } else {
        sortedTasks.forEach(task => {
            const isCompleted = AppState.habitState[todayStr + "_" + task.id];

            const item = document.createElement('div');
            item.className = 'notification-item';

            // Generate Inner HTML based on state
            let timeHtml = task.time
                ? `<span style="font-size:12px; font-weight:600; color:var(--accent);">${task.time}</span>`
                : `<span style="font-size:10px; color:var(--text-muted);">No time set</span>`;

            if (isCompleted) {
                timeHtml = `<span style="font-size:12px; color:var(--success);"><i data-lucide="check" style="width:12px;height:12px;"></i> Done</span>`;
            }

            let actionHtml = '';
            if (!isCompleted) {
                actionHtml = `
                    <div class="upcoming-action">
                        <input type="time" class="quick-time-input" id="quickTime_${task.id}" value="${task.time || ''}">
                        <button class="quick-set-btn" onclick="quickSetTime('${task.id}')">Set</button>
                    </div>
                `;
            }

            item.innerHTML = `
                <div class="upcoming-item">
                    <div class="upcoming-info">
                        <h4 style="text-decoration: ${isCompleted ? 'line-through' : 'none'}; opacity: ${isCompleted ? '0.5' : '1'}">${escapeHTML(task.name)}</h4>
                        ${timeHtml}
                    </div>
                    ${actionHtml}
                </div>
            `;
            upcomingContainer.appendChild(item);
        });

        // Re-init lucide icons for the new dynamic content
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

export function quickSetTime(taskId) {
    const input = document.getElementById(`quickTime_${taskId}`);
    if (!input) return;

    const newTime = input.value;
    const todayStr = getLocalDateString(new Date());
    const tasks = AppState.dailyHabits[todayStr];

    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.time = newTime;
        saveDailyHabits();
        renderHabits(); // Update main UI
        renderNotificationPanel(); // Refresh this panel

        // Remove from notified list so it can trigger again for the new time
        const index = notifiedTasks.tasks.indexOf(taskId);
        if (index > -1) {
            notifiedTasks.tasks.splice(index, 1);
            localStorage.setItem('notifiedTasks', JSON.stringify(notifiedTasks));
        }
    }
}

// Bind to window for inline onclick attributes in HTML
window.quickSetTime = quickSetTime;

// Setup Listeners
document.addEventListener('DOMContentLoaded', () => {
    const bellBtn = document.getElementById('bellBtn');
    const panel = document.getElementById('notificationDropdown');
    const closeBtn = document.getElementById('closeNotifBtn');
    const tabs = document.querySelectorAll('.notif-tab');

    if (bellBtn && panel) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('active');

            if (panel.classList.contains('active')) {
                // Mark all as read when opened
                notificationHistory.forEach(n => n.read = true);
                localStorage.setItem('notifHistory', JSON.stringify(notificationHistory));
                updateBellIconStatus();
                renderNotificationPanel();
            }
        });

        closeBtn.addEventListener('click', () => {
            panel.classList.remove('active');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && !bellBtn.contains(e.target)) {
                panel.classList.remove('active');
            }
        });

        // Tab switching logic
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const target = tab.getAttribute('data-tab');
                document.getElementById('notifHistoryTab').style.display = target === 'history' ? 'block' : 'none';
                document.getElementById('notifUpcomingTab').style.display = target === 'upcoming' ? 'block' : 'none';
            });
        });
    }

    updateBellIconStatus();
});
