// Инициализация Telegram Web App
let tg = window.Telegram?.WebApp || {
    expand: () => {},
    enableClosingConfirmation: () => {},
    showAlert: (msg) => alert(msg),
    showConfirm: (msg, callback) => callback(confirm(msg)),
    BackButton: {
        show: () => {},
        hide: () => {},
        onClick: (callback) => {},
        offClick: (callback) => {}
    },
    MainButton: {
        show: () => {},
        hide: () => {},
        setText: (text) => {},
        onClick: (callback) => {},
        offClick: (callback) => {}
    }
};

if (window.Telegram?.WebApp) {
    tg.expand();
    tg.enableClosingConfirmation();
}

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator && !window.Telegram?.WebApp) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker зарегистрирован'))
            .catch(err => console.log('Service Worker ошибка:', err));
    });
}

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================

let currentDay = 'A';
let currentWorkoutData = {};
let customExercises = [];
let currentProgram = 'fullbody';
let userWorkoutProgram = null;
let userGlutesProgram = null;
let editingExerciseIndex = null;
let currentWorkoutInProgress = null;
let autosaveTimeout = null;

const AI_PLANS_STORAGE_KEY = 'aiWorkoutPlans';
const API_WORKOUT_PLAN_URL = '/api/workout-plan';

function readStorageJSON(key, fallback) {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;

    try {
        return JSON.parse(saved);
    } catch (error) {
        console.warn(`Не удалось прочитать ${key} из localStorage:`, error);
        localStorage.removeItem(key);
        return fallback;
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

function init() {
    updateDate();
    loadCustomExercises();
    loadProgram();
    loadUserPrograms();
    loadCurrentWorkoutInProgress();
    showInstallPrompt();
    setupKeyboardHandlers();
    setupAutosaveHandlers();
}

function setupAutosaveHandlers() {
    const hasWorkoutData = () =>
        currentWorkoutData && Object.keys(currentWorkoutData).length > 0;

    window.addEventListener('beforeunload', () => {
        if (hasWorkoutData()) saveCurrentWorkoutInProgress();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && hasWorkoutData()) saveCurrentWorkoutInProgress();
    });

    // Автосохранение после потери фокуса на поле подхода
    document.addEventListener('focusout', (e) => {
        if (e.target.classList.contains('set-input') && hasWorkoutData()) {
            saveCurrentWorkoutInProgress();
            showSaveIndicator('saved');
        }
    });

    // Автосохранение каждые 30 сек при активном вводе
    setInterval(() => {
        if (document.activeElement?.classList.contains('set-input')) {
            saveCurrentWorkoutInProgress();
        }
    }, 30000);
}

// ============================================
// ПРОГРАММЫ И ХРАНИЛИЩЕ
// ============================================

function loadProgram() {
    const savedProgram = localStorage.getItem('selectedWorkoutProgram');
    if (savedProgram) {
        currentProgram = savedProgram;
    }
}

function loadUserPrograms() {
    userWorkoutProgram = readStorageJSON('userWorkoutProgram', null);
    userGlutesProgram = readStorageJSON('userGlutesProgram', null);
}

function saveUserProgram() {
    const program = currentProgram === 'glutes' ? userGlutesProgram : userWorkoutProgram;
    const key = currentProgram === 'glutes' ? 'userGlutesProgram' : 'userWorkoutProgram';
    if (program) localStorage.setItem(key, JSON.stringify(program));
}

function getCurrentProgram() {
    if (currentProgram?.startsWith('ai_')) return userWorkoutProgram;
    if (currentProgram === 'glutes') return userGlutesProgram || glutesProgram;
    return userWorkoutProgram || workoutProgram;
}

// Создать копию программы если пользователь ещё не редактировал её
function ensureUserProgram() {
    if (currentProgram === 'glutes' && !userGlutesProgram) {
        userGlutesProgram = JSON.parse(JSON.stringify(glutesProgram));
    } else if (currentProgram === 'fullbody' && !userWorkoutProgram) {
        userWorkoutProgram = JSON.parse(JSON.stringify(workoutProgram));
    }
}

function resetToDefaultProgram() {
    if (!confirm('Вернуть план к стандартному? Все изменения будут удалены.')) return;

    if (currentProgram === 'glutes') {
        userGlutesProgram = null;
        localStorage.removeItem('userGlutesProgram');
    } else {
        userWorkoutProgram = null;
        localStorage.removeItem('userWorkoutProgram');
    }

    loadWorkout(currentDay);
    tg.showAlert('✅ План сброшен к стандартному');
}

// ============================================
// АВТОСОХРАНЕНИЕ
// ============================================

function loadCurrentWorkoutInProgress() {
    currentWorkoutInProgress = readStorageJSON('currentWorkoutInProgress', null);
    if (!currentWorkoutInProgress) return;

    const today = new Date().toISOString().split('T')[0];

    if (currentWorkoutInProgress.date === today) {
        currentWorkoutData = currentWorkoutInProgress.exercises || {};
        currentDay = currentWorkoutInProgress.day || 'A';
        currentProgram = currentWorkoutInProgress.program || 'fullbody';
    } else {
        clearCurrentWorkoutInProgress();
    }
}

function saveCurrentWorkoutInProgress() {
    const today = new Date().toISOString().split('T')[0];

    currentWorkoutInProgress = {
        date: today,
        day: currentDay,
        program: currentProgram,
        exercises: currentWorkoutData,
        timestamp: Date.now()
    };

    try {
        localStorage.setItem('currentWorkoutInProgress', JSON.stringify(currentWorkoutInProgress));
        showSaveIndicator('saved');
    } catch (e) {
        console.error('Ошибка сохранения:', e);
        showSaveIndicator('error');
    }
}

function debouncedSave() {
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    showSaveIndicator('saving');
    autosaveTimeout = setTimeout(() => saveCurrentWorkoutInProgress(), 500);
}

function clearCurrentWorkoutInProgress() {
    currentWorkoutInProgress = null;
    localStorage.removeItem('currentWorkoutInProgress');
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function normalizeExerciseName(name) {
    return String(name || '').trim().toLowerCase();
}

function formatSetResult(set) {
    const weight = String(set.weight || '').trim();
    const reps = String(set.reps || '').trim();

    if (weight && reps) return `${weight} кг x ${reps}`;
    if (reps) return `${reps} повт.`;
    if (weight) return `${weight} кг`;
    return '';
}

function formatLastExerciseResult(sets) {
    const completedSets = (sets || []).filter(set =>
        set && (String(set.weight || '').trim() || String(set.reps || '').trim())
    );

    if (completedSets.length === 0) return '';

    const weights = completedSets
        .map(set => String(set.weight || '').trim())
        .filter(Boolean);
    const firstWeight = weights[0];
    const hasSingleWeight = firstWeight && weights.length === completedSets.length &&
        weights.every(weight => weight === firstWeight);

    if (hasSingleWeight) {
        const reps = completedSets
            .map(set => String(set.reps || '').trim())
            .filter(Boolean)
            .join(', ');

        return reps ? `${firstWeight} кг x ${reps}` : `${firstWeight} кг`;
    }

    return completedSets
        .map(formatSetResult)
        .filter(Boolean)
        .join(', ');
}

function getLastExerciseResult(exercise) {
    const today = new Date().toISOString().split('T')[0];
    const history = readStorageJSON('workoutHistory', []);
    const exerciseName = normalizeExerciseName(exercise.name);

    for (const record of history) {
        if (record.dateOnly === today || !record.exercises) continue;

        const previousExercise = record.exercises[exercise.id] ||
            Object.values(record.exercises).find(item =>
                normalizeExerciseName(item?.name) === exerciseName
            );

        const result = formatLastExerciseResult(previousExercise?.sets);
        if (result) return result;
    }

    return '';
}

function showSaveIndicator(status) {
    let indicator = document.getElementById('saveIndicator');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'saveIndicator';
        indicator.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 8px 16px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 700;
            z-index: 999;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 0;
            transform: translateY(-10px);
            pointer-events: none;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
        `;
        document.body.appendChild(indicator);
    }

    const hide = () => {
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateY(-10px)';
    };

    const show = () => {
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateY(0)';
    };

    if (status === 'saving') {
        indicator.textContent = '💾 Сохранение...';
        indicator.style.background = 'rgba(167, 139, 250, 0.2)';
        indicator.style.border = '1px solid rgba(167, 139, 250, 0.4)';
        indicator.style.color = 'var(--primary)';
        show();
    } else if (status === 'saved') {
        indicator.textContent = '✓ Сохранено';
        indicator.style.background = 'rgba(16, 185, 129, 0.2)';
        indicator.style.border = '1px solid rgba(16, 185, 129, 0.4)';
        indicator.style.color = '#10b981';
        show();
        setTimeout(hide, 2000);
    } else if (status === 'restored') {
        indicator.textContent = '🔄 Тренировка восстановлена';
        indicator.style.background = 'rgba(167, 139, 250, 0.2)';
        indicator.style.border = '1px solid rgba(167, 139, 250, 0.4)';
        indicator.style.color = 'var(--primary)';
        show();
        setTimeout(hide, 3000);
    } else if (status === 'error') {
        indicator.textContent = '⚠️ Ошибка';
        indicator.style.background = 'rgba(239, 68, 68, 0.2)';
        indicator.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        indicator.style.color = '#ef4444';
        show();
        setTimeout(hide, 3000);
    }
}

// ============================================
// НАВИГАЦИЯ
// ============================================

function switchPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

    const pageMap = {
        'mainMenu':  'mainMenu',
        'workout':   'workoutPage',
        'history':   'historyPage',
        'progress':  'progressPage',
        'exercises': 'exercisesPage',
        'aiTrainer': 'aiTrainerPage',
        'myPlan':    'myPlanPage'
    };

    document.getElementById(pageMap[pageName]).classList.add('active');

    const fabBack = document.getElementById('fabBack');
    fabBack.classList.toggle('active', pageName !== 'mainMenu');

    if (pageName === 'workout')        loadWorkoutProgramSelection();
    else if (pageName === 'history')   loadHistory();
    else if (pageName === 'progress')  loadProgress();
    else if (pageName === 'exercises') loadExercisesGuide();
    else if (pageName === 'aiTrainer') loadAITrainerPage();
    else if (pageName === 'myPlan')    loadMyPlanPage();
}

function openWorkoutPage() {
    switchPage('workout');

    const savedProgram = localStorage.getItem('selectedWorkoutProgram');
    if (savedProgram) {
        selectWorkoutProgram(savedProgram);
    }
}

function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('ru-RU', options);
    document.getElementById('currentDate').textContent = dateStr;
    const workoutDateEl = document.getElementById('workoutDate');
    if (workoutDateEl) workoutDateEl.textContent = dateStr;
}

// ============================================
// КЛАВИАТУРА
// ============================================

function hideKeyboard() {
    if (document.activeElement?.matches('input, textarea')) {
        document.activeElement.blur();
    }
    document.getElementById('keyboardDoneBtn').classList.remove('active');
}

// Вызывается из HTML кнопки "Готово"
function hideKeyboardWithButton() {
    hideKeyboard();
}

function setupKeyboardHandlers() {
    document.addEventListener('focusin', (e) => {
        if (e.target.matches('input, textarea')) {
            document.getElementById('keyboardDoneBtn').classList.add('active');
        }
    });

    document.addEventListener('focusout', (e) => {
        if (e.target.matches('input, textarea')) {
            setTimeout(() => {
                if (!document.activeElement?.matches('input, textarea')) {
                    hideKeyboard();
                }
            }, 100);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.matches('input, textarea')) {
            hideKeyboard();
        }
    });
}

// ============================================
// PWA
// ============================================

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
});

function showInstallButton() {
    if (window.Telegram?.WebApp) return;

    const installBtn = document.createElement('button');
    installBtn.id = 'installBtn';
    installBtn.className = 'btn-modern';
    installBtn.style.cssText = 'position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 1000; background: var(--primary); color: white; padding: 12px 24px; border-radius: 12px; font-weight: bold; box-shadow: var(--shadow-lg);';
    installBtn.textContent = '📱 Установить приложение';
    installBtn.onclick = installApp;
    document.body.appendChild(installBtn);
}

async function installApp() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') console.log('Приложение установлено');

    deferredPrompt = null;
    document.getElementById('installBtn')?.remove();
}

function showInstallPrompt() {
    if (!window.Telegram?.WebApp && /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone) {
        if (!localStorage.getItem('pwaInstructionShown')) {
            setTimeout(() => {
                alert('💡 Совет: Добавьте приложение на домашний экран!\n\nНажмите кнопку "Поделиться" внизу Safari и выберите "На экран Домой"');
                localStorage.setItem('pwaInstructionShown', 'true');
            }, 2000);
        }
    }
}

// ============================================
// ВЫБОР ПРОГРАММЫ
// ============================================

function loadWorkoutProgramSelection() {
    document.getElementById('workoutProgramSelection').classList.remove('hidden');
    document.getElementById('workoutDaySelection').classList.add('hidden');

    const aiPlans = readStorageJSON(AI_PLANS_STORAGE_KEY, []);
    const aiProgramsList = document.getElementById('aiProgramsList');

    if (aiPlans.length > 0) {
        let html = '<div class="mt-4 pt-4" style="border-top: 2px dashed var(--border-color);"><p class="text-sm opacity-70 mb-3 text-center font-semibold">🤖 Мои AI Планы</p>';

        aiPlans.forEach(plan => {
            const date = new Date(plan.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            html += `
                <div class="program-card w-full text-left flex items-center justify-between text-white mb-3" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.8) 0%, rgba(236, 72, 153, 0.8) 100%);">
                    <div onclick="selectWorkoutProgram('${plan.id}')" class="flex items-center gap-4 flex-1 cursor-pointer">
                        <div class="text-4xl">🤖</div>
                        <div class="flex-1">
                            <div class="text-lg font-bold">${plan.name.replace('AI План - ', '')}</div>
                            <div class="text-sm opacity-90 mt-1">${plan.description}</div>
                            <div class="text-xs opacity-75 mt-1">Создан: ${date}</div>
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); deleteAIPlan('${plan.id}')" class="icon-btn text-2xl" title="Удалить">
                        🗑️
                    </button>
                </div>
            `;
        });

        html += '</div>';
        aiProgramsList.innerHTML = html;
    } else {
        aiProgramsList.innerHTML = '';
    }
}

function selectWorkoutProgram(programId) {
    localStorage.setItem('selectedWorkoutProgram', programId);

    if (programId === 'fullbody' || programId === 'glutes') {
        currentProgram = programId;

        document.getElementById('workoutProgramSelection').classList.add('hidden');
        document.getElementById('workoutDaySelection').classList.remove('hidden');

        document.getElementById('currentProgramName').textContent =
            programId === 'fullbody' ? '💪 Full Body' : '🍑 Ягодицы';

        updateDate();
        updateProgramButtons();

        const today = new Date().toISOString().split('T')[0];
        if (
            currentWorkoutInProgress &&
            currentWorkoutInProgress.date === today &&
            currentWorkoutInProgress.program === programId
        ) {
            selectDay(currentWorkoutInProgress.day);
            setTimeout(() => showSaveIndicator('restored'), 500);
        } else {
            selectDay('A');
        }
    } else {
        loadAIPlanAsProgram(programId);
    }
}

function loadAIPlanAsProgram(planId) {
    const aiPlans = readStorageJSON(AI_PLANS_STORAGE_KEY, []);
    const plan = aiPlans.find(p => p.id === planId);

    if (!plan) {
        tg.showAlert('⚠️ План не найден');
        return;
    }

    currentProgram = planId;
    userWorkoutProgram = plan.program;

    document.getElementById('workoutProgramSelection').classList.add('hidden');
    document.getElementById('workoutDaySelection').classList.remove('hidden');
    document.getElementById('currentProgramName').textContent = `🤖 ${plan.name.replace('AI План - ', '')}`;

    updateDate();
    selectDay('A');
}

function deleteAIPlan(planId) {
    let aiPlans = readStorageJSON(AI_PLANS_STORAGE_KEY, []);
    aiPlans = aiPlans.filter(p => p.id !== planId);
    localStorage.setItem(AI_PLANS_STORAGE_KEY, JSON.stringify(aiPlans));
    loadWorkoutProgramSelection();
    tg.showAlert('✅ План удалён');
}

function backToProgramSelection() {
    document.getElementById('workoutProgramSelection').classList.remove('hidden');
    document.getElementById('workoutDaySelection').classList.add('hidden');
}

function updateProgramButtons() {
    const fullbodyBtn = document.getElementById('fullbodyBtn');
    const glutesBtn = document.getElementById('glutesBtn');
    if (!fullbodyBtn || !glutesBtn) return;

    fullbodyBtn.classList.toggle('active', currentProgram === 'fullbody');
    glutesBtn.classList.toggle('active', currentProgram !== 'fullbody');
}

// ============================================
// ТРЕНИРОВКА
// ============================================

function selectDay(day) {
    currentDay = day;

    document.querySelectorAll('.day-btn[data-day]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.day === day);
    });

    loadWorkout(day);
}

function loadWorkout(day) {
    if (typeof workoutProgram === 'undefined' || typeof glutesProgram === 'undefined') {
        console.error('Программы тренировок не загружены!');
        document.getElementById('exercisesList').innerHTML =
            '<div class="card-modern text-center p-4"><p class="text-red-500">Ошибка загрузки программ. Обнови страницу.</p></div>';
        return;
    }

    const program = getCurrentProgram();
    const workout = program[day];

    if (!workout) {
        console.error('День тренировки не найден:', day, 'в программе:', currentProgram);
        return;
    }

    const container = document.getElementById('exercisesList');

    const today = new Date().toISOString().split('T')[0];
    if (
        currentWorkoutInProgress &&
        currentWorkoutInProgress.date === today &&
        currentWorkoutInProgress.day === day &&
        currentWorkoutInProgress.program === currentProgram
    ) {
        currentWorkoutData = currentWorkoutInProgress.exercises;
    } else {
        currentWorkoutData = {};
    }

    let html = '';

    workout.exercises.forEach((exercise, index) => {
        if (!currentWorkoutData[exercise.id]) {
            currentWorkoutData[exercise.id] = { name: exercise.name, sets: [] };
        }

        const lastResult = getLastExerciseResult(exercise);
        const details = `
            <span class="exercise-meta-chip exercise-meta-plan">${escapeHTML(`${exercise.sets} × ${exercise.reps}`)}</span>
            ${exercise.muscleGroups ? `<span class="exercise-meta-chip exercise-meta-muscles">${escapeHTML(exercise.muscleGroups)}</span>` : ''}
            ${lastResult ? `<span class="exercise-meta-chip exercise-meta-last">Прошлый раз: ${escapeHTML(lastResult)}</span>` : ''}
        `;

        html += `
            <details class="exercise-item" data-exercise-id="${exercise.id}">
                <summary class="cursor-pointer flex justify-between items-center">
                    <div class="flex-1 pr-3">
                        <h3 class="exercise-name">${exercise.emoji} ${exercise.name}</h3>
                        <p class="exercise-details">${details}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="event.stopPropagation(); editExercise(${index})" class="icon-btn">✏️</button>
                        <button onclick="event.stopPropagation(); deleteExercise(${index})" class="icon-btn">🗑️</button>
                        <span class="text-lg arrow opacity-60">▼</span>
                    </div>
                </summary>

                <div class="mt-4 pt-4" style="border-top: 1px solid var(--border-color);">
                    <div class="mb-4">
                        <p class="text-sm opacity-80 mb-3 leading-relaxed">${exercise.technique}</p>
                        ${exercise.youtubeUrl ? `<a href="${exercise.youtubeUrl}" target="_blank" class="youtube-link">▶️ Смотреть технику</a>` : ''}
                    </div>

                    <div class="space-y-3">
        `;

        for (let i = 0; i < exercise.sets; i++) {
            const savedSet = currentWorkoutData[exercise.id].sets[i] || {};
            html += `
                <div class="grid grid-cols-3 gap-3 items-center">
                    <div class="flex items-center">
                        <span class="text-sm font-semibold opacity-70">Подход ${i + 1}</span>
                    </div>
                    <input
                        type="number"
                        placeholder="Вес"
                        inputmode="decimal"
                        value="${savedSet.weight || ''}"
                        class="set-input"
                        onchange="updateSet('${exercise.id}', ${i}, 'weight', this.value)"
                    >
                    <input
                        type="number"
                        placeholder="Повт"
                        inputmode="numeric"
                        value="${savedSet.reps || ''}"
                        class="set-input"
                        onchange="updateSet('${exercise.id}', ${i}, 'reps', this.value)"
                    >
                </div>
            `;
        }

        html += `
                    </div>
                    <div class="flex gap-2 mt-4">
                        <button onclick="event.stopPropagation(); event.preventDefault(); addSetToExercise(${index})" class="add-set-btn flex-1 text-sm py-3">
                            ➕ Добавить подход
                        </button>
                        <button onclick="event.stopPropagation(); saveCurrentWorkoutInProgress()" class="save-btn flex-1 text-sm py-3">
                            💾 Сохранить
                        </button>
                    </div>
                </div>
            </details>
        `;
    });

    container.innerHTML = html;
    saveCurrentWorkoutInProgress();
}

function updateSet(exerciseId, setIndex, field, value) {
    if (!currentWorkoutData[exerciseId].sets[setIndex]) {
        currentWorkoutData[exerciseId].sets[setIndex] = {};
    }
    currentWorkoutData[exerciseId].sets[setIndex][field] = value;
    debouncedSave();
}

function addSetToExercise(exerciseIndex) {
    ensureUserProgram();

    const program = getCurrentProgram();
    const exercise = program[currentDay].exercises[exerciseIndex];
    exercise.sets += 1;

    saveUserProgram();

    const openExerciseId = exercise.id;
    loadWorkout(currentDay);

    setTimeout(() => {
        const detailsElement = document.querySelector(`details[data-exercise-id="${openExerciseId}"]`);
        if (detailsElement) detailsElement.open = true;
    }, 10);

    tg.showAlert('✅ Подход добавлен!');
}

function completeWorkout() {
    let hasData = false;
    for (let exerciseId in currentWorkoutData) {
        const exercise = currentWorkoutData[exerciseId];
        if (exercise.sets?.length > 0) {
            const validSets = exercise.sets.filter(set => set && (set.weight || set.reps));
            if (validSets.length > 0) { hasData = true; break; }
        }
    }

    if (!hasData) {
        tg.showAlert('⚠️ Заполните хотя бы одно упражнение!');
        return;
    }

    const program = getCurrentProgram();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const workoutRecord = {
        date: now.toISOString(),
        dateOnly: today,
        dateFormatted: now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        day: currentDay,
        dayName: program[currentDay].name,
        program: currentProgram,
        exercises: JSON.parse(JSON.stringify(currentWorkoutData))
    };

    let history = readStorageJSON('workoutHistory', []);
    const existingIndex = history.findIndex(record => record.dateOnly === today);

    if (existingIndex !== -1) {
    const existing = history[existingIndex];

    for (let exerciseId in workoutRecord.exercises) {

        // Если упражнения ещё нет → просто добавить
        if (!existing.exercises[exerciseId]) {
            existing.exercises[exerciseId] = workoutRecord.exercises[exerciseId];
            continue;
        }

        // Если упражнение уже есть → объединяем подходы
        const oldSets = existing.exercises[exerciseId].sets || [];
        const newSets = workoutRecord.exercises[exerciseId].sets || [];

        // Добавляем только новые подходы
        existing.exercises[exerciseId].sets = [
            ...oldSets,
            ...newSets
        ];
    }

    existing.date = workoutRecord.date;
    existing.dateFormatted = workoutRecord.dateFormatted;

    history[existingIndex] = existing;
} else {
        history.unshift(workoutRecord);
    }

    localStorage.setItem('workoutHistory', JSON.stringify(history));

    clearCurrentWorkoutInProgress();
    currentWorkoutData = {};

    tg.showAlert('✅ Тренировка сохранена!', () => switchPage('mainMenu'));
}

// ============================================
// РЕДАКТИРОВАНИЕ УПРАЖНЕНИЙ
// ============================================

function editExercise(index) {
    const program = getCurrentProgram();
    const exercise = program[currentDay].exercises[index];
    editingExerciseIndex = index;

    document.getElementById('editExerciseName').value = exercise.name;
    document.getElementById('editExerciseSets').value = exercise.sets;
    document.getElementById('editExerciseReps').value = exercise.reps;
    document.getElementById('editExerciseModal').classList.add('active');
}

function closeEditExerciseModal() {
    document.getElementById('editExerciseModal').classList.remove('active');
    editingExerciseIndex = null;
}

function saveExerciseEdit() {
    if (editingExerciseIndex === null) return;

    const name = document.getElementById('editExerciseName').value.trim();
    const sets = parseInt(document.getElementById('editExerciseSets').value);
    const reps = document.getElementById('editExerciseReps').value.trim();

    if (!name || !sets || !reps) {
        alert('Заполните все поля');
        return;
    }

    ensureUserProgram();

    const program = getCurrentProgram();
    const exercise = program[currentDay].exercises[editingExerciseIndex];
    exercise.name = name;
    exercise.sets = sets;
    exercise.reps = reps;

    saveUserProgram();
    closeEditExerciseModal();
    loadWorkout(currentDay);
    updateAfterEdit();

    tg.showAlert('✅ Изменения сохранены!');
}

function deleteExercise(index) {
    if (!confirm('Удалить это упражнение?')) return;

    ensureUserProgram();

    const program = getCurrentProgram();
    program[currentDay].exercises.splice(index, 1);

    saveUserProgram();
    loadWorkout(currentDay);
    updateAfterEdit();

    tg.showAlert('✅ Упражнение удалено!');
}

function moveExerciseUp(index) {
    if (index === 0) return;

    ensureUserProgram();

    const exercises = getCurrentProgram()[currentDay].exercises;
    [exercises[index], exercises[index - 1]] = [exercises[index - 1], exercises[index]];

    saveUserProgram();
    loadWorkout(currentDay);
    updateAfterEdit();
}

function moveExerciseDown(index) {
    const exercises = getCurrentProgram()[currentDay].exercises;
    if (index === exercises.length - 1) return;

    ensureUserProgram();
    [exercises[index], exercises[index + 1]] = [exercises[index + 1], exercises[index]];

    saveUserProgram();
    loadWorkout(currentDay);
    updateAfterEdit();
}

function updateAfterEdit() {
    const myPlanPage = document.getElementById('myPlanPage');
    if (myPlanPage?.classList.contains('active')) {
        loadEditExercisesList(currentDay);
    }
}

// ============================================
// МОЙ ПЛАН (РЕЖИМ РЕДАКТИРОВАНИЯ)
// ============================================

function loadMyPlanPage() {
    updateProgramButtonsForEdit();
    selectDayForEdit('A');
}

function switchProgramForEdit(program) {
    currentProgram = program;
    updateProgramButtonsForEdit();
    selectDayForEdit('A');
}

function updateProgramButtonsForEdit() {
    const fullbodyBtn = document.getElementById('editFullbodyBtn');
    const glutesBtn = document.getElementById('editGlutesBtn');
    if (!fullbodyBtn || !glutesBtn) return;

    fullbodyBtn.classList.toggle('active', currentProgram === 'fullbody');
    glutesBtn.classList.toggle('active', currentProgram !== 'fullbody');
}

function selectDayForEdit(day) {
    currentDay = day;

    document.querySelectorAll('[data-edit-day]').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-edit-day="${day}"]`).classList.add('active');

    loadEditExercisesList(day);
}

function loadEditExercisesList(day) {
    const program = getCurrentProgram();
    const workout = program[day];
    const container = document.getElementById('editExercisesList');

    let html = `
        <div class="card-modern mb-4">
            <h3 class="text-lg font-bold mb-3" style="background: var(--primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                ${workout.emoji} ${workout.name}
            </h3>
            <button onclick="showAddExerciseFromGuideModal()" class="btn-modern w-full">
                ➕ Добавить упражнение
            </button>
        </div>
    `;

    workout.exercises.forEach((exercise, index) => {
        html += `
            <div class="card-modern mb-3">
                <div class="flex items-center gap-3 mb-3">
                    <span class="text-2xl">${exercise.emoji}</span>
                    <div class="flex-1">
                        <div class="font-bold">${exercise.name}</div>
                        <div class="text-sm opacity-70">${exercise.sets} × ${exercise.reps}</div>
                    </div>
                </div>
                <div class="grid grid-cols-4 gap-2">
                    <button onclick="event.stopPropagation(); moveExerciseUp(${index})" class="py-2 rounded-lg font-semibold text-sm" style="background: rgba(255,255,255,0.05)" ${index === 0 ? 'style="opacity: 0.3; pointer-events: none;"' : ''}>
                        ⬆️
                    </button>
                    <button onclick="event.stopPropagation(); moveExerciseDown(${index})" class="py-2 rounded-lg font-semibold text-sm" style="background: rgba(255,255,255,0.05)" ${index === workout.exercises.length - 1 ? 'style="opacity: 0.3; pointer-events: none;"' : ''}>
                        ⬇️
                    </button>
                    <button onclick="event.stopPropagation(); editExercise(${index})" class="py-2 rounded-lg font-semibold text-sm" style="background: rgba(255,255,255,0.05)">
                        ✏️
                    </button>
                    <button onclick="event.stopPropagation(); deleteExercise(${index})" class="py-2 rounded-lg font-semibold text-sm" style="background: var(--danger-bg); border: 1px solid var(--danger); color: var(--danger);">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============================================
// СПРАВОЧНИК УПРАЖНЕНИЙ
// ============================================

function showAddExerciseFromGuideModal() {
    loadAllExercises();
}

function closeAddExerciseFromGuideModal() {
    document.getElementById('addExerciseFromGuideModal').classList.remove('active');
}

function loadAllExercises() {
    const container = document.getElementById('exercisesList');
    const categories = {};

    allExercises.forEach(exercise => {
        if (!categories[exercise.category]) categories[exercise.category] = [];
        categories[exercise.category].push(exercise);
    });

    let html = '';

    Object.keys(categories).forEach(category => {
        html += `<div class="mb-4"><h4 class="text-sm font-bold opacity-70 mb-3">${category}</h4>`;

        categories[category].forEach(exercise => {
            html += `
                <div onclick="addExerciseFromGuide('${exercise.name}', '${exercise.emoji}', '${exercise.youtubeUrl}')"
                     class="card-modern p-4 mb-2 cursor-pointer hover:bg-white hover:bg-opacity-10 transition-all">
                    <div class="flex items-center gap-3">
                        <span class="text-3xl">${exercise.emoji}</span>
                        <div class="flex-1">
                            <div class="font-semibold text-base">${exercise.name}</div>
                            ${exercise.muscleGroups ? `<div class="text-sm opacity-70 mt-1">${exercise.muscleGroups}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
    });

    container.innerHTML = html;
}

function addExerciseFromGuide(name, emoji, youtubeUrl) {
    ensureUserProgram();

    const exerciseFromGuide = allExercises.find(ex => ex.name === name);
    const program = getCurrentProgram();

    const newExercise = {
        id: 'guide_' + Date.now(),
        name,
        emoji,
        sets: 4,
        reps: '12',
        technique: '',
        youtubeUrl,
        muscleGroups: exerciseFromGuide?.muscleGroups || ''
    };

    program[currentDay].exercises.push(newExercise);
    saveUserProgram();
    document.getElementById('exercisesList').innerHTML = '';
    loadWorkout(currentDay);
    tg.showAlert('✅ Упражнение добавлено!');
}

function showAddCustomExerciseModal() {
    document.getElementById('addCustomExerciseModal').classList.add('active');
}

function closeAddCustomExerciseModal() {
    document.getElementById('addCustomExerciseModal').classList.remove('active');
    document.getElementById('customExerciseName').value = '';
    document.getElementById('customExerciseSets').value = '';
    document.getElementById('customExerciseReps').value = '';
}

function addCustomExercise() {
    const name = document.getElementById('customExerciseName').value.trim();
    if (!name) {
        alert('Введите название упражнения');
        return;
    }

    const setsInput = document.getElementById('customExerciseSets').value.trim();
    const repsInput = document.getElementById('customExerciseReps').value.trim();
    const sets = setsInput ? parseInt(setsInput) : 4;
    const reps = repsInput || '12';

    ensureUserProgram();

    const program = getCurrentProgram();
    const newExercise = {
        id: 'custom_' + Date.now(),
        name,
        emoji: '✏️',
        sets,
        reps,
        technique: '',
        youtubeUrl: ''
    };

    program[currentDay].exercises.push(newExercise);
    saveUserProgram();
    closeAddCustomExerciseModal();
    loadWorkout(currentDay);
    tg.showAlert('✅ Упражнение добавлено!');
}

function loadCustomExercises() {
    customExercises = readStorageJSON('customExercises', []);
}

function saveCustomExercises() {
    localStorage.setItem('customExercises', JSON.stringify(customExercises));
}

// ============================================
// КАЛЬКУЛЯТОР 1RM
// ============================================

function calculateBenchRM() {
    const weight = parseFloat(document.getElementById('benchWeight').value);
    const reps = parseInt(document.getElementById('benchReps').value);
    const resultEl = document.getElementById('rmResult');

    if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps < 1 || reps > 30) {
        resultEl.classList.remove('hidden');
        resultEl.textContent = 'Введите корректные данные';
        return;
    }

    const epley    = weight * (1 + reps / 30);
    const brzycki  = weight * (36 / (37 - reps));
    const lander   = (100 * weight) / (101.3 - 2.67123 * reps);
    const lombardi = weight * Math.pow(reps, 0.10);
    const mayhew   = (100 * weight) / (52.2 + 41.9 * Math.exp(-0.055 * reps));
    const oconnor  = weight * (1 + 0.025 * reps);
    const watanabe = (100 * weight) / (48.8 + 53.8 * Math.exp(-0.075 * reps));

    const average = (epley + brzycki + lander + lombardi + mayhew + oconnor + watanabe) / 7;
    const finalResult = Math.round(average);

    resultEl.classList.remove('hidden');
    resultEl.replaceChildren(
        document.createTextNode(`${finalResult} кг`),
        Object.assign(document.createElement('small'), {
            textContent: 'Примерный 1RM на основе 7 формул'
        })
    );
}

// ============================================
// ИСТОРИЯ
// ============================================

function loadHistory() {
    const history = readStorageJSON('workoutHistory', []);
    const container = document.getElementById('historyContent');

    if (history.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 opacity-50">
                <div class="text-4xl mb-2">📝</div>
                <p>История тренировок пуста</p>
                <p class="text-sm mt-1">Завершите первую тренировку!</p>
            </div>
        `;
        return;
    }

    let html = '';

    history.forEach((record, recordIndex) => {
        const dateStr = new Date(record.date).toLocaleDateString('ru-RU', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        html += `
            <details class="card-modern mb-4">
                <summary class="cursor-pointer flex justify-between items-center">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="chip">
                                ${record.program === 'fullbody' ? '💪 Full Body' : '🍑 Ягодицы'}
                            </span>
                        </div>
                        <h3 class="text-lg font-bold">${record.dayName}</h3>
                        <p class="text-sm opacity-70 mt-1">📅 ${record.dateFormatted}</p>
                    </div>
                    <div class="flex items-center gap-3">

    <button
        onclick="event.stopPropagation(); editHistoryWorkout(${recordIndex})"
        class="text-xl opacity-70 hover:opacity-100"
    >
        ✏️
    </button>

    <button
        onclick="event.stopPropagation(); deleteHistoryWorkout(${recordIndex})"
        class="text-xl opacity-70 hover:opacity-100 text-red-400"
    >
        🗑
    </button>

    <span class="text-xl arrow">▼</span>

</div>
                </summary>
                <div class="mt-4 pt-4 border-t border-white border-opacity-10 space-y-3">
        `;

        for (let exerciseId in record.exercises) {
            const exercise = record.exercises[exerciseId];
            if (exercise.sets?.length > 0) {
                const validSets = exercise.sets.filter(set => set && (set.weight || set.reps));
                if (validSets.length > 0) {
                    html += `
                        <div class="bg-white bg-opacity-5 rounded-xl p-3">
                            <div class="font-semibold text-base mb-2">${exercise.name}</div>
                            <div class="grid grid-cols-2 gap-2 text-sm">
                    `;

                    validSets.forEach((set, setIndex) => {
                        if (set.weight || set.reps) {
                            html += `
                                <div class="flex items-center gap-2 opacity-80">
                                    <span class="text-xs opacity-60">Подход ${setIndex + 1}:</span>
                                    <span class="font-semibold">${set.weight || '—'} кг × ${set.reps || '—'}</span>
                                </div>
                            `;
                        }
                    });

                    html += `</div></div>`;
                }
            }
        }

        html += `</div></details>`;
    });

    container.innerHTML = html;
}

function deleteHistoryWorkout(recordIndex) {

    if (!confirm('Удалить всю тренировку?')) {
        return;
    }

    let history = readStorageJSON('workoutHistory', []);

    history.splice(recordIndex, 1);

    localStorage.setItem(
        'workoutHistory',
        JSON.stringify(history)
    );

    loadHistory();
    loadProgress();

    tg.showAlert('🗑 Тренировка удалена');
}

function editHistoryWorkout(recordIndex) {
    const history = readStorageJSON('workoutHistory', []);
    const record = history[recordIndex];
    if (!record) return;

    document.getElementById('editHistoryModal').classList.add('active');
    document.getElementById('editHistoryIndex').value = recordIndex;

    const container = document.getElementById('editHistoryExercises');
    let html = `<h3 class="text-lg font-bold mb-3">${record.dayName}</h3>`;

    for (let exerciseId in record.exercises) {
        const exercise = record.exercises[exerciseId];
        if (exercise.sets?.length > 0) {
            html += `
                 <div class="card-modern mb-3">

        <div class="flex justify-between items-center mb-2">

            <div class="font-semibold">
                ${exercise.name}
            </div>

            <button
                onclick="deleteExerciseFromHistory(${recordIndex}, '${exerciseId}')"
                class="text-red-400 opacity-70 hover:opacity-100 text-sm"
            >
                🗑
            </button>

        </div>

        <div class="space-y-2">
`;

            exercise.sets.forEach((set, setIndex) => {
                if (set && (set.weight || set.reps)) {
                    html += `
                        <div class="grid grid-cols-3 gap-2">
                            <span class="text-sm opacity-70 flex items-center">Подход ${setIndex + 1}</span>
                            <input type="number" value="${set.weight || ''}" placeholder="Вес"
                                   class="input-modern text-sm"
                                   data-exercise="${exerciseId}" data-set="${setIndex}" data-field="weight">
                            <input type="number" value="${set.reps || ''}" placeholder="Повт"
                                   class="input-modern text-sm"
                                   data-exercise="${exerciseId}" data-set="${setIndex}" data-field="reps">
                        </div>
                    `;
                }
            });

            html += `</div></div>`;
        }
    }

    container.innerHTML = html;
}

function deleteExerciseFromHistory(recordIndex, exerciseId) {

    if (!confirm('Удалить упражнение из истории?')) {
        return;
    }

    let history = readStorageJSON('workoutHistory', []);

    if (!history[recordIndex]) return;

    delete history[recordIndex].exercises[exerciseId];

    // Если упражнений не осталось — удалить тренировку полностью
    if (
        Object.keys(history[recordIndex].exercises).length === 0
    ) {
        history.splice(recordIndex, 1);

        closeEditHistoryModal();
    }

    localStorage.setItem(
        'workoutHistory',
        JSON.stringify(history)
    );

    loadHistory();
    loadProgress();

    tg.showAlert('🗑 Упражнение удалено');
}

function saveHistoryEdit() {
    const recordIndex = parseInt(document.getElementById('editHistoryIndex').value);
    const history = readStorageJSON('workoutHistory', []);
    const record = history[recordIndex];
    if (!record) return;

    document.querySelectorAll('#editHistoryExercises input').forEach(input => {
        const exerciseId = input.dataset.exercise;
        const setIndex = parseInt(input.dataset.set);
        const field = input.dataset.field;
        if (record.exercises[exerciseId]?.sets[setIndex]) {
            record.exercises[exerciseId].sets[setIndex][field] = input.value;
        }
    });

    history[recordIndex] = record;
    localStorage.setItem('workoutHistory', JSON.stringify(history));

    closeEditHistoryModal();
    loadHistory();
    tg.showAlert('✅ Изменения сохранены!');
}

function closeEditHistoryModal() {
    document.getElementById('editHistoryModal').classList.remove('active');
}

// ============================================
// ПРОГРЕСС
// ============================================

function loadProgress() {

    const history = readStorageJSON('workoutHistory', []);

    let totalWorkouts = 0;

history.forEach(record => {
    for (let exerciseId in record.exercises) {
        const exercise = record.exercises[exerciseId];

        if (exercise.sets?.some(set => set && (set.weight || set.reps))) {
            totalWorkouts++;
            break;
        }
    }
});

const totalWorkoutsEl = document.getElementById('totalWorkouts');

totalWorkoutsEl.textContent = history.length;
totalWorkoutsEl.style.color = '#ffffff';
totalWorkoutsEl.style.fontSize = '34px';
totalWorkoutsEl.style.fontWeight = '700';

    // ===== STREAK =====

    let streak = 0;

    if (history.length > 0) {

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < history.length; i++) {

            const workoutDate = new Date(history[i].date);

            workoutDate.setHours(0, 0, 0, 0);

            const diffDays = Math.floor(
                (today - workoutDate) /
                (1000 * 60 * 60 * 24)
            );

            if (diffDays === i) {
                streak++;
            } else {
                break;
            }
        }
    }

    document.getElementById('currentStreak').textContent =
        streak;

    // ЗАГРУЗКА ВСЕХ РЕКОРДОВ
    loadProgressExercises();
}

// Загрузка личных рекордов
function loadProgressExercises() {
    const history = readStorageJSON('workoutHistory', []);
    const container = document.getElementById('progressExercisesList');

    if (history.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 opacity-50">
                <div class="text-3xl mb-2">📊</div>
                <p>Нет данных тренировок</p>
            </div>
        `;
        return;
    }

    // Максимальные веса
    const exerciseRecords = {};

    history.forEach(record => {
        for (let exerciseId in record.exercises) {
            const exercise = record.exercises[exerciseId];

            if (!exercise.sets) continue;

            const maxWeight = Math.max(
                ...exercise.sets.map(set => parseFloat(set.weight) || 0)
            );

            if (maxWeight <= 0) continue;

            // Сохраняем только лучший результат
            if (
                !exerciseRecords[exercise.name] ||
                maxWeight > exerciseRecords[exercise.name].weight
            ) {
                exerciseRecords[exercise.name] = {
                    name: exercise.name,
                    weight: maxWeight
                };
            }
        }
    });

    // Разделение верх / низ
    const upperBody = [];
    const lowerBody = [];

    Object.values(exerciseRecords).forEach(exercise => {
        const lowerKeywords = [
            'ног',
            'ягод',
            'икр',
            'присед',
            'выпад',
            'румын',
            'станов'
        ];

        const exerciseName = exercise.name || 'Без названия';

const isLower = lowerKeywords.some(keyword =>
    exerciseName.toLowerCase().includes(keyword)
);

        if (isLower) {
            lowerBody.push(exercise);
        } else {
            upperBody.push(exercise);
        }
    });

    // Сортировка по весу
    upperBody.sort((a, b) => b.weight - a.weight);
    lowerBody.sort((a, b) => b.weight - a.weight);

    function renderSection(title, exercises) {
        if (exercises.length === 0) return '';

        return `
            <div class="mb-6">
                <h3 class="text-lg font-bold mb-3">
                    ${title}
                </h3>

                <div class="space-y-3">
                    ${exercises.map(exercise => `
                        <div class="bg-white bg-opacity-5 rounded-2xl p-4 flex justify-between items-center border border-white border-opacity-5">

                            <div>
                                <div class="font-semibold text-white">
                                    ${exercise.name}
                                </div>

                                <div class="text-sm opacity-60 mt-1">
                                    Максимальный вес
                                </div>
                            </div>

                            <div class="text-2xl font-bold text-white">
                                ${exercise.weight} кг
                            </div>

                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="card-modern p-5">

            <h2 class="text-xl font-bold mb-5">
                🏆 Личные рекорды
            </h2>

            ${renderSection('💪 Верх тела', upperBody)}

            ${renderSection('🦵 Низ тела', lowerBody)}

        </div>
    `;
}

// ============================================
// СПРАВОЧНИК (ГАЙДЫ)
// ============================================

function loadExercisesGuide() {
    const container = document.getElementById('exercisesGuide');
    const categories = {};

    allExercises.forEach(exercise => {
        if (!categories[exercise.category]) categories[exercise.category] = [];
        categories[exercise.category].push(exercise);
    });

    let html = '';

    Object.keys(categories).forEach(category => {
        html += `
            <div class="mb-6">
                <h3 class="guide-category-title">${escapeHTML(category)}</h3>
                <div class="space-y-3">
        `;

        categories[category].forEach(exercise => {
            html += `
                <div class="card-modern">
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">${exercise.emoji}</span>
                            <span class="font-semibold">${exercise.name}</span>
                        </div>
                        <a href="${exercise.youtubeUrl}" target="_blank" class="youtube-link">▶️ Видео</a>
                    </div>
                    ${exercise.muscleGroups ? `<div class="text-sm opacity-70 ml-11">${exercise.muscleGroups}</div>` : ''}
                </div>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

// ============================================
// AI ТРЕНЕР
// ============================================

function loadAITrainerPage() {
    const data = readStorageJSON('aiTrainerData', null);
    if (!data) return;

    document.getElementById('aiGender').value = data.gender || 'Мужской';
    document.getElementById('aiAge').value = data.age || '';
    document.getElementById('aiWeight').value = data.weight || '';
    document.getElementById('aiHeight').value = data.height || '';
    document.getElementById('aiExperience').value = data.experience || 'Новичок (0-6 месяцев)';
    document.getElementById('aiGoal').value = data.goal || 'Набор мышечной массы';
    document.getElementById('aiEquipment').value = data.equipment || 'Полный зал (штанги, гантели, тренажеры)';
    document.getElementById('aiPreferredExercises').value = data.preferredExercises || '';

    if (data.focusAreas?.length > 0) {
        const select = document.getElementById('aiFocusAreas');
        for (let option of select.options) {
            option.selected = data.focusAreas.includes(option.value);
        }
    }
}

async function generateAIPlan() {
    const gender             = document.getElementById('aiGender').value;
    const age                = document.getElementById('aiAge').value;
    const weight             = document.getElementById('aiWeight').value;
    const height             = document.getElementById('aiHeight').value;
    const experience         = document.getElementById('aiExperience').value;
    const goal               = document.getElementById('aiGoal').value;
    const equipment          = document.getElementById('aiEquipment').value;
    const preferredExercises = document.getElementById('aiPreferredExercises').value.trim();
    const focusAreas         = Array.from(document.getElementById('aiFocusAreas').selectedOptions).map(o => o.value);

    if (!age || !weight || !height) {
        tg.showAlert('⚠️ Заполни все поля!');
        return;
    }

    localStorage.setItem('aiTrainerData', JSON.stringify({
        gender, age, weight, height, experience, goal, equipment, preferredExercises, focusAreas
    }));

    const btn = document.getElementById('generateBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Генерирую план...';
    btn.disabled = true;

    try {
        const response = await fetch(API_WORKOUT_PLAN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gender, age, weight, height, experience, goal, equipment, preferredExercises, focusAreas })
        });

        if (!response.ok) throw new Error('Ошибка API');

        const data = await response.json();

        if (data.isText) {
            document.getElementById('aiPlanContent').textContent = data.plan;
            localStorage.setItem('lastGeneratedAIPlan', JSON.stringify({
                plan: data.plan, isText: true,
                userData: { gender, age, weight, height, experience, goal, equipment, preferredExercises, focusAreas },
                timestamp: new Date().toISOString()
            }));
        } else {
            document.getElementById('aiPlanContent').textContent = formatPlanAsText(data.plan);
            localStorage.setItem('lastGeneratedAIPlan', JSON.stringify({
                plan: data.plan, isText: false,
                userData: { gender, age, weight, height, experience, goal, equipment, preferredExercises, focusAreas },
                timestamp: new Date().toISOString()
            }));
        }

        document.getElementById('aiPlanResult').classList.remove('hidden');
        document.getElementById('aiPlanResult').scrollIntoView({ behavior: 'smooth' });
        tg.showAlert('✅ План готов!');

    } catch (error) {
        console.error('Error:', error);
        tg.showAlert('❌ Ошибка при генерации плана. Проверь подключение к интернету.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function formatPlanAsText(plan) {
    let text = '';

    ['A', 'B', 'C'].forEach(day => {
        if (!plan[day]) return;
        text += `\n${plan[day].emoji} ${plan[day].name}\n`;
        text += '─'.repeat(40) + '\n\n';
        plan[day].exercises.forEach((ex, index) => {
            text += `${index + 1}. ${ex.emoji} ${ex.name}\n`;
            text += `   Подходы: ${ex.sets} x ${ex.reps}\n`;
            text += `   Техника: ${ex.technique}\n\n`;
        });
    });

    if (plan.nutrition) text += `\n🍎 Питание\n${'─'.repeat(40)}\n${plan.nutrition}\n\n`;
    if (plan.rest)      text += `\n😴 Отдых\n${'─'.repeat(40)}\n${plan.rest}\n`;

    return text;
}

function saveAIPlanToWorkouts() {
    const lastPlan = localStorage.getItem('lastGeneratedAIPlan');
    if (!lastPlan) {
        tg.showAlert('⚠️ Нет сгенерированного плана');
        return;
    }

    const planData = readStorageJSON('lastGeneratedAIPlan', null);
    if (!planData) {
        tg.showAlert('⚠️ Сгенерированный план поврежден. Создай новый план.');
        return;
    }

    if (planData.isText) {
        tg.showAlert('⚠️ Этот план в старом формате. Сгенерируй новый план для сохранения.');
        return;
    }

    let aiPlans = readStorageJSON(AI_PLANS_STORAGE_KEY, []);

    const newPlan = {
        id: 'ai_' + Date.now(),
        name: `AI План - ${planData.userData.goal}`,
        description: `Пол: ${planData.userData.gender}, Возраст: ${planData.userData.age}, Опыт: ${planData.userData.experience}`,
        program: planData.plan,
        userData: planData.userData,
        createdAt: planData.timestamp
    };

    aiPlans.push(newPlan);
    localStorage.setItem(AI_PLANS_STORAGE_KEY, JSON.stringify(aiPlans));
    tg.showAlert('✅ План добавлен в Тренировки!');
}

// ============================================
// ЗАПУСК
// ============================================

window.onload = () => init();
