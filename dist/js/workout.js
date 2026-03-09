import { AppState, getLocalDateString, saveWorkoutData as saveWorkoutDataToCloud } from './main.js';
import { updateXPUI } from './ui.js';
import { escapeHTML, sanitizeInput, clampNumber } from '../utils/storage.js';

// Init state if missing
if (!AppState.workoutData) {
    AppState.workoutData = JSON.parse(localStorage.getItem("workoutData")) || {};
}

// DOM Elements
const workoutList = document.getElementById('workoutList');
const workoutEmptyState = document.getElementById('workoutEmptyState');
const addExerciseBtn = document.getElementById('addExerciseBtn');
const addExerciseModal = document.getElementById('addExerciseModal');
const closeAddExerciseBtn = document.getElementById('closeAddExerciseBtn');
const cancelExerciseBtn = document.getElementById('cancelExerciseBtn');
const addExerciseForm = document.getElementById('addExerciseForm');
const workoutTotalExercises = document.getElementById('workoutTotalExercises');
const workoutTotalVolume = document.getElementById('workoutTotalVolume');

// Initialization
export function initWorkout() {
    renderWorkouts();
    setupEventListeners();
}

function setupEventListeners() {
    // Open Modal
    addExerciseBtn.addEventListener('click', () => {
        addExerciseModal.classList.add('active');
        addExerciseForm.reset();
    });

    // Close Modal
    const closeModal = () => addExerciseModal.classList.remove('active');
    closeAddExerciseBtn.addEventListener('click', closeModal);
    cancelExerciseBtn.addEventListener('click', closeModal);
    document.getElementById('addExerciseModalOverlay').addEventListener('click', closeModal);

    // Form Submit
    addExerciseForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = sanitizeInput(document.getElementById('exerciseName').value, 100);
        const sets = clampNumber(document.getElementById('exerciseSets').value, 1, 50);
        const reps = clampNumber(document.getElementById('exerciseReps').value, 1, 500);
        const weight = clampNumber(document.getElementById('exerciseWeight').value, 0, 2000);

        if (!name) return;

        addExercise(name, sets, reps, weight);
        closeModal();
    });
}

function addExercise(name, sets, reps, weight) {
    const today = getLocalDateString();
    if (!AppState.workoutData[today]) {
        AppState.workoutData[today] = [];
    }

    const newExercise = {
        id: 'ex_' + Date.now(),
        name,
        sets,
        reps,
        weight,
        completedSets: 0
    };

    AppState.workoutData[today].push(newExercise);
    saveWorkoutData();
    renderWorkouts();

    if (window.showToast) window.showToast("Exercise Added", "var(--accent)");
}

export function renderWorkouts() {
    if (!workoutList) return;

    const today = getLocalDateString();
    const todayWorkouts = AppState.workoutData[today] || [];

    // Clear list but keep empty state
    const exercises = workoutList.querySelectorAll('.exercise-card');
    exercises.forEach(ex => ex.remove());

    let totalVolume = 0;

    if (todayWorkouts.length === 0) {
        workoutEmptyState.style.display = 'block';
    } else {
        workoutEmptyState.style.display = 'none';

        todayWorkouts.forEach(ex => {
            const card = document.createElement('div');
            card.className = 'exercise-card bento-hover';

            // Calculate Volume for this exercise
            const exVolume = ex.completedSets * ex.reps * (ex.weight || 1); // 1 if bodyweight
            totalVolume += exVolume;

            const isDone = ex.completedSets >= ex.sets;
            const titleColor = isDone ? 'var(--text-dim)' : 'var(--text-main)';
            const statusIcon = isDone ? '<i data-lucide="check-circle" style="color: var(--accent);"></i>' : '';

            let setsBarsHTML = '';
            for (let i = 0; i < ex.sets; i++) {
                const isSetDone = i < ex.completedSets;
                setsBarsHTML += `<div style="flex: 1; height: 6px; border-radius: 3px; background: ${isSetDone ? 'var(--accent)' : 'rgba(255,255,255,0.1)'};"></div>`;
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <h4 style="color: ${titleColor}; font-size: 16px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                            ${escapeHTML(ex.name)} ${statusIcon}
                        </h4>
                        <span style="color: var(--text-soft); font-size: 13px;">${ex.sets} Sets x ${ex.reps} Reps ${ex.weight > 0 ? `| ${ex.weight} kg` : ''}</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 4px; margin-bottom: 16px;">
                    ${setsBarsHTML}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: var(--text-dim);">${ex.completedSets}/${ex.sets} Sets Complete</span>
                    <button class="log-set-btn" data-id="${ex.id}" ${isDone ? 'disabled' : ''} style="background: ${isDone ? 'transparent' : 'rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.1)'}; color: ${isDone ? 'var(--text-dim)' : 'var(--accent)'}; border: 1px solid ${isDone ? 'var(--border)' : 'var(--accent)'}; padding: 6px 12px; border-radius: 8px; font-size: 13px; cursor: ${isDone ? 'default' : 'pointer'};">
                        ${isDone ? 'Finished' : 'Log Set'}
                    </button>
                </div>
            `;

            workoutList.appendChild(card);
        });
    }

    // Update Quick Stats
    if (workoutTotalExercises) workoutTotalExercises.textContent = todayWorkouts.length;
    if (workoutTotalVolume) workoutTotalVolume.textContent = totalVolume > 0 ? `${totalVolume} kg` : '0 kg';

    if (window.lucide) window.lucide.createIcons();

    // Bind Log Set Buttons
    const logBtns = workoutList.querySelectorAll('.log-set-btn');
    logBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.disabled) return;
            const exId = e.currentTarget.getAttribute('data-id');
            logSet(exId);
        });
    });
}

function logSet(exId) {
    const today = getLocalDateString();
    const workouts = AppState.workoutData[today];
    if (!workouts) return;

    const exIndex = workouts.findIndex(x => x.id === exId);
    if (exIndex === -1) return;

    if (workouts[exIndex].completedSets < workouts[exIndex].sets) {
        workouts[exIndex].completedSets++;

        // Award XP per set
        awardWorkoutXP(5);

        // If exercise completed
        if (workouts[exIndex].completedSets === workouts[exIndex].sets) {
            awardWorkoutXP(15); // Bonus for full exercise
            if (window.showToast) window.showToast(`Exercise Complete! +20 XP`, "var(--accent)");
        } else {
            if (window.showToast) window.showToast(`Set logged! +5 XP`, "var(--text-main)");
        }

        saveWorkoutData();
        renderWorkouts();
    }
}

function awardWorkoutXP(amount) {
    if (!AppState.xpData) return;
    AppState.xpData.totalXP += amount;
    localStorage.setItem("xpData", JSON.stringify(AppState.xpData));
    updateXPUI();
}

function saveWorkoutData() {
    localStorage.setItem("workoutData", JSON.stringify(AppState.workoutData));
    // Sync to Supabase via centralized sync in main.js
    if (typeof saveWorkoutDataToCloud === 'function') {
        saveWorkoutDataToCloud();
    }
}

// Global hook if needed
window.renderWorkouts = renderWorkouts;

// Initialize when script loads
document.addEventListener('DOMContentLoaded', initWorkout);
