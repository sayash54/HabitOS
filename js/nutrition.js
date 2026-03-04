import { AppState, getLocalDateString } from './main.js';
import { updateXPUI } from './ui.js';

// Init state if missing
if (!AppState.nutritionData) {
    AppState.nutritionData = JSON.parse(localStorage.getItem("nutritionData")) || {};
}
if (!AppState.waterData) {
    AppState.waterData = JSON.parse(localStorage.getItem("waterData")) || {};
}

// DOM Elements
const nutritionList = document.getElementById('nutritionList');
const nutritionEmptyState = document.getElementById('nutritionEmptyState');
const addMealBtn = document.getElementById('addMealBtn');
const addMealModal = document.getElementById('addMealModal');
const closeAddMealBtn = document.getElementById('closeAddMealBtn');
const cancelMealBtn = document.getElementById('cancelMealBtn');
const addMealForm = document.getElementById('addMealForm');

// Stats Elements
const calorieCurrent = document.getElementById('calorieCurrent');
const calorieTarget = document.getElementById('calorieTarget');
const calorieRing = document.getElementById('calorieRing');
const macroProtein = document.getElementById('macroProtein');
const macroCarbs = document.getElementById('macroCarbs');
const macroFat = document.getElementById('macroFat');

// Water Elements
const waterCount = document.getElementById('waterCount');
const waterMinusBtn = document.getElementById('waterMinusBtn');
const waterPlusBtn = document.getElementById('waterPlusBtn');

const DAILY_CALORIE_TARGET = 2000;
const RING_CIRCUMFERENCE = 326; // 2 * pi * 52

export function initNutrition() {
    renderNutrition();
    renderWater();
    setupEventListeners();
}

function setupEventListeners() {
    // Open Modal
    addMealBtn.addEventListener('click', () => {
        addMealModal.classList.add('active');
        addMealForm.reset();
    });

    // Close Modal
    const closeModal = () => addMealModal.classList.remove('active');
    closeAddMealBtn.addEventListener('click', closeModal);
    cancelMealBtn.addEventListener('click', closeModal);
    document.getElementById('addMealModalOverlay').addEventListener('click', closeModal);

    // Form Submit
    addMealForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const type = document.getElementById('mealType').value;
        const name = document.getElementById('mealName').value.trim();
        const calories = parseInt(document.getElementById('mealCalories').value) || 0;
        const protein = parseInt(document.getElementById('mealProtein').value) || 0;
        const carbs = parseInt(document.getElementById('mealCarbs').value) || 0;
        const fat = parseInt(document.getElementById('mealFat').value) || 0;

        if (!name || calories <= 0) return;

        addMeal(type, name, calories, protein, carbs, fat);
        closeModal();
    });

    // Water Tracker
    waterPlusBtn.addEventListener('click', () => {
        const today = getLocalDateString();
        const current = AppState.waterData[today] || 0;
        if (current < 20) { // arbitrary max
            AppState.waterData[today] = current + 1;
            awardNutritionXP(2); // 2 XP per glass of water
            saveNutritionData();
            renderWater();
        }
    });

    waterMinusBtn.addEventListener('click', () => {
        const today = getLocalDateString();
        const current = AppState.waterData[today] || 0;
        if (current > 0) {
            AppState.waterData[today] = current - 1;
            // Assuming no negative XP, or maybe subtract? Better not to subtract XP for taking away a glass to prevent weird loops.
            saveNutritionData();
            renderWater();
        }
    });
}

function addMeal(type, name, calories, protein, carbs, fat) {
    const today = getLocalDateString();
    if (!AppState.nutritionData[today]) {
        AppState.nutritionData[today] = [];
    }

    const newMeal = {
        id: 'meal_' + Date.now(),
        type,
        name,
        calories,
        protein,
        carbs,
        fat,
        timestamp: Date.now()
    };

    AppState.nutritionData[today].push(newMeal);

    awardNutritionXP(5); // 5 XP per meal logged
    saveNutritionData();
    renderNutrition();

    if (window.showToast) window.showToast("Meal Logged", "var(--accent)");
}

export function renderNutrition() {
    if (!nutritionList) return;
    const today = getLocalDateString();
    const todayMeals = AppState.nutritionData[today] || [];

    // Clear list
    const mealCards = nutritionList.querySelectorAll('.meal-card');
    mealCards.forEach(card => card.remove());

    let totalCals = 0, totalP = 0, totalC = 0, totalF = 0;

    if (todayMeals.length === 0) {
        nutritionEmptyState.style.display = 'block';
    } else {
        nutritionEmptyState.style.display = 'none';

        // Sort by timestamp if needed, but append order is fine
        todayMeals.forEach(meal => {
            totalCals += meal.calories;
            totalP += meal.protein;
            totalC += meal.carbs;
            totalF += meal.fat;

            const card = document.createElement('div');
            card.className = 'meal-card bento-hover';
            card.style.background = 'rgba(255,255,255,0.02)';
            card.style.border = '1px solid var(--border)';
            card.style.borderRadius = '16px';
            card.style.padding = '16px';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';

            card.innerHTML = `
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div style="background: rgba(255,255,255,0.05); width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--accent);">
                        <i data-lucide="${getIconForMeal(meal.type)}"></i>
                    </div>
                    <div>
                        <h4 style="color: var(--text-main); font-size: 15px; margin-bottom: 2px;">${meal.name}</h4>
                        <span style="color: var(--text-soft); font-size: 12px;">${meal.type}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 16px; font-weight: 600; color: var(--text-main);">${meal.calories}</div>
                    <div style="font-size: 11px; color: var(--text-dim);">kcal</div>
                </div>
            `;

            nutritionList.appendChild(card);
        });
    }

    // Update Macros
    if (calorieCurrent) calorieCurrent.textContent = totalCals;
    if (macroProtein) macroProtein.textContent = totalP + 'g';
    if (macroCarbs) macroCarbs.textContent = totalC + 'g';
    if (macroFat) macroFat.textContent = totalF + 'g';

    // Update Ring
    if (calorieRing) {
        const pct = Math.min((totalCals / DAILY_CALORIE_TARGET), 1);
        const offset = RING_CIRCUMFERENCE - (pct * RING_CIRCUMFERENCE);
        calorieRing.style.strokeDashoffset = offset;

        if (totalCals >= DAILY_CALORIE_TARGET) {
            calorieRing.style.stroke = "var(--text-main)"; // Turn white/grey when target hit or exceeded
        } else {
            calorieRing.style.stroke = "var(--accent)";
        }
    }

    if (window.lucide) window.lucide.createIcons();
}

function renderWater() {
    if (!waterCount) return;
    const today = getLocalDateString();
    const count = AppState.waterData[today] || 0;
    waterCount.textContent = count;
}

function getIconForMeal(type) {
    switch (type) {
        case 'Breakfast': return 'coffee';
        case 'Lunch': return 'sun';
        case 'Dinner': return 'moon';
        case 'Snack': return 'apple';
        default: return 'utensils';
    }
}

function awardNutritionXP(amount) {
    if (!AppState.xpData) return;
    AppState.xpData.totalXP += amount;
    localStorage.setItem("xpData", JSON.stringify(AppState.xpData));
    updateXPUI();
}

function saveNutritionData() {
    localStorage.setItem("nutritionData", JSON.stringify(AppState.nutritionData));
    localStorage.setItem("waterData", JSON.stringify(AppState.waterData));
}

// Global hooks
window.renderNutrition = renderNutrition;

// Initialize
document.addEventListener('DOMContentLoaded', initNutrition);
