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
            .then(reg => console.log('Service Worker зарегистрирован'))
            .catch(err => console.log('Service Worker ошибка:', err));
    });
}

// Глобальные переменные
let currentDay = 'A';
let currentWorkoutData = {};
let customExercises = [];
let currentProgram = 'fullbody'; // 'fullbody' или 'glutes'
let userWorkoutProgram = null; // Пользовательский план Full Body
let userGlutesProgram = null; // Пользовательский план Ягодицы
let selectedExerciseForConfig = null; // Выбранное упражнение для настройки
let editingExerciseIndex = null; // Индекс редактируемого упражнения
let currentWorkoutInProgress = null; // Текущая незавершенная тренировка

// Инициализация приложения
function init() {
    updateDate();
    loadTheme();
    loadCustomExercises();
    loadProgram();
    loadUserPrograms(); // Загрузить пользовательские планы
    loadCurrentWorkoutInProgress(); // Загрузить незавершенную тренировку
    showInstallPrompt(); // Показать кнопку установки PWA
    setupKeyboardHandlers();
}

// Загрузить незавершенную тренировку
function loadCurrentWorkoutInProgress() {
    const saved = localStorage.getItem('currentWorkoutInProgress');
    if (saved) {
        currentWorkoutInProgress = JSON.parse(saved);
    }
}

// Сохранить текущую тренировку (автосохранение)
function saveCurrentWorkoutInProgress() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    currentWorkoutInProgress = {
        date: today,
        day: currentDay,
        program: currentProgram,
        exercises: currentWorkoutData
    };

    localStorage.setItem('currentWorkoutInProgress', JSON.stringify(currentWorkoutInProgress));
}

// Очистить текущую тренировку
function clearCurrentWorkoutInProgress() {
    currentWorkoutInProgress = null;
    localStorage.removeItem('currentWorkoutInProgress');
}

// Загрузка пользовательских планов из localStorage
function loadUserPrograms() {
    const savedFullBody = localStorage.getItem('userWorkoutProgram');
    const savedGlutes = localStorage.getItem('userGlutesProgram');

    if (savedFullBody) {
        userWorkoutProgram = JSON.parse(savedFullBody);
    }

    if (savedGlutes) {
        userGlutesProgram = JSON.parse(savedGlutes);
    }
}

// Сохранить пользовательский план
function saveUserProgram() {
    const program = currentProgram === 'glutes' ? userGlutesProgram : userWorkoutProgram;
    const key = currentProgram === 'glutes' ? 'userGlutesProgram' : 'userWorkoutProgram';

    if (program) {
        localStorage.setItem(key, JSON.stringify(program));
    }
}

// Получить текущую программу (пользовательскую или стандартную)
function getCurrentProgram() {
    // Если это AI план
    if (currentProgram && currentProgram.startsWith('ai_')) {
        return userWorkoutProgram;
    }

    if (currentProgram === 'glutes') {
        return userGlutesProgram || glutesProgram;
    } else {
        return userWorkoutProgram || workoutProgram;
    }
}

// Сбросить план к стандартному
function resetToDefaultProgram() {
    if (confirm('Вернуть план к стандартному? Все изменения будут удалены.')) {
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
}

// Смена программы тренировок
function switchProgram(program) {
    currentProgram = program;
    localStorage.setItem('currentProgram', program);

    // Обновить UI
    updateProgramButtons();

    // Автоматически выбрать День А
    selectDay('A');
}

// Обновление даты
function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('ru-RU', options);
    document.getElementById('currentDate').textContent = dateStr;
    const workoutDateEl = document.getElementById('workoutDate');
    if (workoutDateEl) workoutDateEl.textContent = dateStr;
}

// Переключение страниц
function switchPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

    const pageMap = {
        'mainMenu': 'mainMenu',
        'workout': 'workoutPage',
        'history': 'historyPage',
        'progress': 'progressPage',
        'exercises': 'exercisesPage',
        'aiTrainer': 'aiTrainerPage',
        'myPlan': 'myPlanPage'
    };

    document.getElementById(pageMap[pageName]).classList.add('active');

    // Показать/скрыть кнопку "Назад"
    const fabBack = document.getElementById('fabBack');
    if (pageName === 'mainMenu') {
        fabBack.classList.remove('active');
    } else {
        fabBack.classList.add('active');
    }

    if (pageName === 'workout') {
        loadWorkoutProgramSelection();
    } else if (pageName === 'history') {
        loadHistory();
    } else if (pageName === 'progress') {
        loadProgress();
    } else if (pageName === 'exercises') {
        loadExercisesGuide();
    } else if (pageName === 'aiTrainer') {
        loadAITrainerPage();
    } else if (pageName === 'myPlan') {
        loadMyPlanPage();
    }
}

// Загрузка страницы "Мой план"
function loadMyPlanPage() {
    updateProgramButtonsForEdit();
    selectDayForEdit('A');
}

// Обновить кнопки выбора программы на странице тренировки
function updateProgramButtons() {
    const fullbodyBtn = document.getElementById('fullbodyBtn');
    const glutesBtn = document.getElementById('glutesBtn');

    if (fullbodyBtn && glutesBtn) {
        fullbodyBtn.classList.remove('active');
        glutesBtn.classList.remove('active');

        if (currentProgram === 'fullbody') {
            fullbodyBtn.classList.add('active');
        } else {
            glutesBtn.classList.add('active');
        }
    }
}

// Переключение программы для редактирования
function switchProgramForEdit(program) {
    currentProgram = program;
    updateProgramButtonsForEdit();
    selectDayForEdit('A');
}

// Обновить кнопки выбора программы для редактирования
function updateProgramButtonsForEdit() {
    const fullbodyBtn = document.getElementById('editFullbodyBtn');
    const glutesBtn = document.getElementById('editGlutesBtn');

    if (fullbodyBtn && glutesBtn) {
        fullbodyBtn.classList.remove('active');
        glutesBtn.classList.remove('active');

        if (currentProgram === 'fullbody') {
            fullbodyBtn.classList.add('active');
        } else {
            glutesBtn.classList.add('active');
        }
    }
}

// Выбор дня для редактирования
function selectDayForEdit(day) {
    currentDay = day;

    document.querySelectorAll('[data-edit-day]').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelector(`[data-edit-day="${day}"]`).classList.add('active');

    loadEditExercisesList(day);
}

// Загрузка списка упражнений для редактирования
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
                    <button onclick="event.stopPropagation(); deleteExercise(${index})" class="py-2 rounded-lg font-semibold text-sm" style="background: rgba(255,0,0,0.1); border: 1px solid rgba(255,0,0,0.3);">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Обновить список после изменений
function refreshEditList() {
    loadEditExercisesList(currentDay);
}

// Смена темы
function changeTheme(theme) {
    document.body.className = theme === 'purple' ? '' : `theme-${theme}`;

    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    localStorage.setItem('appTheme', theme);
}

// Загрузка темы
function loadTheme() {
    const savedTheme = localStorage.getItem('appTheme') || 'purple';
    if (savedTheme !== 'purple') {
        document.body.className = `theme-${savedTheme}`;
    }

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const themeMap = { 'purple': 0, 'orange': 1, 'pink': 2, 'blue': 3, 'green': 4 };
    document.querySelectorAll('.theme-btn')[themeMap[savedTheme]].classList.add('active');
}

// Загрузка программы из localStorage
function loadProgram() {
    const savedProgram = localStorage.getItem('currentProgram');
    if (savedProgram) {
        currentProgram = savedProgram;
    }
}

// Загрузка пользовательских упражнений
function loadCustomExercises() {
    const saved = localStorage.getItem('customExercises');
    if (saved) {
        try {
            customExercises = JSON.parse(saved);
        } catch (e) {
            console.error('Ошибка загрузки пользовательских упражнений:', e);
            customExercises = [];
        }
    }
}

// Сохранение пользовательских упражнений
function saveCustomExercises() {
    localStorage.setItem('customExercises', JSON.stringify(customExercises));
}

// Выбор дня тренировки
function selectDay(day) {
    currentDay = day;

    document.querySelectorAll('.day-btn[data-day]').forEach(btn => {
        if (btn.dataset.day === day) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    loadWorkout(day);
}

// Загрузка тренировки
function loadWorkout(day) {
    // Проверка доступности программ
    if (typeof workoutProgram === 'undefined' || typeof glutesProgram === 'undefined') {
        console.error('Программы тренировок не загружены!');
        const container = document.getElementById('exercisesList');
        container.innerHTML = '<div class="card-modern text-center p-4"><p class="text-red-500">Ошибка загрузки программ. Обнови страницу.</p></div>';
        return;
    }

    const program = getCurrentProgram();
    const workout = program[day];

    if (!workout) {
        console.error('День тренировки не найден:', day, 'в программе:', currentProgram);
        return;
    }

    const container = document.getElementById('exercisesList');

    // Проверить, есть ли сохраненная тренировка на сегодня
    const today = new Date().toISOString().split('T')[0];
    if (currentWorkoutInProgress &&
        currentWorkoutInProgress.date === today &&
        currentWorkoutInProgress.day === day &&
        currentWorkoutInProgress.program === currentProgram) {
        // Восстановить данные из сохраненной тренировки
        currentWorkoutData = currentWorkoutInProgress.exercises;
    } else {
        // Начать новую тренировку
        currentWorkoutData = {};
    }

    let html = '';

    workout.exercises.forEach((exercise, index) => {
        // Инициализировать данные упражнения если их нет
        if (!currentWorkoutData[exercise.id]) {
            currentWorkoutData[exercise.id] = {
                name: exercise.name,
                sets: []
            };
        }

        html += `
            <details class="exercise-item" data-exercise-id="${exercise.id}">
                <summary class="cursor-pointer flex justify-between items-center">
                    <div class="flex-1 pr-3">
                        <h3 class="exercise-name">${exercise.emoji} ${exercise.name}</h3>
                        <p class="exercise-details">${exercise.sets} × ${exercise.reps}${exercise.muscleGroups ? ` • ${exercise.muscleGroups}` : ''}</p>
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
                        <button onclick="event.stopPropagation(); event.preventDefault(); addSetToExercise(${index})" class="btn-modern flex-1 text-sm py-3" style="background: rgba(139, 92, 246, 0.2); border: 1px solid var(--primary-solid);">
                            ➕ Добавить подход
                        </button>
                        <button onclick="event.stopPropagation(); saveCurrentWorkoutInProgress()" class="btn-modern flex-1 text-sm py-3">
                            💾 Сохранить
                        </button>
                    </div>
                </div>
            </details>
        `;
    });

    container.innerHTML = html;

    // Сохранить текущее состояние
    saveCurrentWorkoutInProgress();
}

// Обновление данных подхода
function updateSet(exerciseId, setIndex, field, value) {
    if (!currentWorkoutData[exerciseId].sets[setIndex]) {
        currentWorkoutData[exerciseId].sets[setIndex] = {};
    }
    currentWorkoutData[exerciseId].sets[setIndex][field] = value;

    // Автосохранение при каждом изменении
    saveCurrentWorkoutInProgress();
}

// Добавить подход к упражнению
function addSetToExercise(exerciseIndex) {
    // Создать копию программы если её ещё нет
    if (currentProgram === 'glutes' && !userGlutesProgram) {
        userGlutesProgram = JSON.parse(JSON.stringify(glutesProgram));
    } else if (currentProgram === 'fullbody' && !userWorkoutProgram) {
        userWorkoutProgram = JSON.parse(JSON.stringify(workoutProgram));
    }

    const program = getCurrentProgram();
    const exercise = program[currentDay].exercises[exerciseIndex];

    // Увеличить количество подходов
    exercise.sets += 1;

    saveUserProgram();

    // Сохранить ID открытого упражнения
    const openExerciseId = exercise.id;

    loadWorkout(currentDay);

    // Восстановить открытое состояние после перерисовки
    setTimeout(() => {
        const detailsElement = document.querySelector(`details[data-exercise-id="${openExerciseId}"]`);
        if (detailsElement) {
            detailsElement.open = true;
        }
    }, 10);

    tg.showAlert('✅ Подход добавлен!');
}

// Показать модальное окно добавления упражнения из справочника
function showAddExerciseFromGuideModal() {
    document.getElementById('addExerciseFromGuideModal').classList.add('active');
    loadAllExercises();
}

// Закрыть модальное окно
function closeAddExerciseFromGuideModal() {
    document.getElementById('addExerciseFromGuideModal').classList.remove('active');
}

// Загрузить все упражнения из справочника
function loadAllExercises() {
    const container = document.getElementById('exercisesList');
    let html = '';

    // Группировка по категориям
    const categories = {};
    allExercises.forEach(exercise => {
        if (!categories[exercise.category]) {
            categories[exercise.category] = [];
        }
        categories[exercise.category].push(exercise);
    });

    Object.keys(categories).forEach(category => {
        html += `<div class="mb-4">
            <h4 class="text-sm font-bold opacity-70 mb-3">${category}</h4>
        `;

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

// Добавить упражнение из справочника сразу в план
function addExerciseFromGuide(name, emoji, youtubeUrl) {
    // Создать копию программы если её ещё нет
    if (currentProgram === 'glutes' && !userGlutesProgram) {
        userGlutesProgram = JSON.parse(JSON.stringify(glutesProgram));
    } else if (currentProgram === 'fullbody' && !userWorkoutProgram) {
        userWorkoutProgram = JSON.parse(JSON.stringify(workoutProgram));
    }

    const program = getCurrentProgram();

    // Найти упражнение в справочнике для получения muscleGroups
    const exerciseFromGuide = allExercises.find(ex => ex.name === name);

    const newExercise = {
        id: 'guide_' + Date.now(),
        name: name,
        emoji: emoji,
        sets: 4,
        reps: '12',
        technique: '',
        youtubeUrl: youtubeUrl,
        muscleGroups: exerciseFromGuide ? exerciseFromGuide.muscleGroups : ''
    };

    program[currentDay].exercises.push(newExercise);
    saveUserProgram();
    closeAddExerciseFromGuideModal();
    loadMyPlan();

    tg.showAlert('✅ Упражнение добавлено!');
}

// Показать модальное окно создания своего упражнения
function showAddCustomExerciseModal() {
    document.getElementById('addCustomExerciseModal').classList.add('active');
}

// Закрыть модальное окно создания своего упражнения
function closeAddCustomExerciseModal() {
    document.getElementById('addCustomExerciseModal').classList.remove('active');
    document.getElementById('customExerciseName').value = '';
    document.getElementById('customExerciseSets').value = '';
    document.getElementById('customExerciseReps').value = '';
}

// Добавить пользовательское упражнение
function addCustomExercise() {
    const name = document.getElementById('customExerciseName').value.trim();
    if (!name) {
        alert('Введите название упражнения');
        return;
    }

    // Получить значения подходов и повторений или использовать значения по умолчанию
    const setsInput = document.getElementById('customExerciseSets').value.trim();
    const repsInput = document.getElementById('customExerciseReps').value.trim();

    const sets = setsInput ? parseInt(setsInput) : 4;
    const reps = repsInput ? repsInput : '12';

    // Создать копию программы если её ещё нет
    if (currentProgram === 'glutes' && !userGlutesProgram) {
        userGlutesProgram = JSON.parse(JSON.stringify(glutesProgram));
    } else if (currentProgram === 'fullbody' && !userWorkoutProgram) {
        userWorkoutProgram = JSON.parse(JSON.stringify(workoutProgram));
    }

    const program = getCurrentProgram();
    const newExercise = {
        id: 'custom_' + Date.now(),
        name: name,
        emoji: '✏️',
        sets: sets,
        reps: reps,
        technique: '',
        youtubeUrl: ''
    };

    program[currentDay].exercises.push(newExercise);
    saveUserProgram();
    closeAddCustomExerciseModal();
    loadWorkout(currentDay);

    tg.showAlert('✅ Упражнение добавлено!');
}

// Редактировать упражнение
function editExercise(index) {
    const program = getCurrentProgram();
    const exercise = program[currentDay].exercises[index];

    editingExerciseIndex = index;

    document.getElementById('editExerciseName').value = exercise.name;
    document.getElementById('editExerciseSets').value = exercise.sets;
    document.getElementById('editExerciseReps').value = exercise.reps;
    document.getElementById('editExerciseModal').classList.add('active');
}

// Закрыть модальное окно редактирования
function closeEditExerciseModal() {
    document.getElementById('editExerciseModal').classList.remove('active');
    editingExerciseIndex = null;
}

// Сохранить изменения упражнения
function saveExerciseEdit() {
    if (editingExerciseIndex === null) return;

    const name = document.getElementById('editExerciseName').value.trim();
    const sets = parseInt(document.getElementById('editExerciseSets').value);
    const reps = document.getElementById('editExerciseReps').value.trim();

    if (!name || !sets || !reps) {
        alert('Заполните все поля');
        return;
    }

    // Создать копию программы если её ещё нет
    if (currentProgram === 'glutes' && !userGlutesProgram) {
        userGlutesProgram = JSON.parse(JSON.stringify(glutesProgram));
    } else if (currentProgram === 'fullbody' && !userWorkoutProgram) {
        userWorkoutProgram = JSON.parse(JSON.stringify(workoutProgram));
    }

    const program = getCurrentProgram();
    program[currentDay].exercises[editingExerciseIndex].name = name;
    program[currentDay].exercises[editingExerciseIndex].sets = sets;
    program[currentDay].exercises[editingExerciseIndex].reps = reps;

    saveUserProgram();
    closeEditExerciseModal();
    loadWorkout(currentDay);
    updateAfterEdit();

    tg.showAlert('✅ Изменения сохранены!');
}

// Удалить упражнение
function deleteExercise(index) {
    if (!confirm('Удалить это упражнение?')) return;

    // Создать копию программы если её ещё нет
    if (currentProgram === 'glutes' && !userGlutesProgram) {
        userGlutesProgram = JSON.parse(JSON.stringify(glutesProgram));
    } else if (currentProgram === 'fullbody' && !userWorkoutProgram) {
        userWorkoutProgram = JSON.parse(JSON.stringify(workoutProgram));
    }

    const program = getCurrentProgram();
    program[currentDay].exercises.splice(index, 1);

    saveUserProgram();
    loadWorkout(currentDay);
    updateAfterEdit();

    tg.showAlert('✅ Упражнение удалено!');
}

// Переместить упражнение вверх
function moveExerciseUp(index) {
    if (index === 0) return;

    // Создать копию программы если её ещё нет
    if (currentProgram === 'glutes' && !userGlutesProgram) {
        userGlutesProgram = JSON.parse(JSON.stringify(glutesProgram));
    } else if (currentProgram === 'fullbody' && !userWorkoutProgram) {
        userWorkoutProgram = JSON.parse(JSON.stringify(workoutProgram));
    }

    const program = getCurrentProgram();
    const exercises = program[currentDay].exercises;
    [exercises[index], exercises[index - 1]] = [exercises[index - 1], exercises[index]];

    saveUserProgram();
    loadWorkout(currentDay);
    updateAfterEdit();
}

// Переместить упражнение вниз
function moveExerciseDown(index) {
    const program = getCurrentProgram();
    const exercises = program[currentDay].exercises;

    if (index === exercises.length - 1) return;

    // Создать копию программы если её ещё нет
    if (currentProgram === 'glutes' && !userGlutesProgram) {
        userGlutesProgram = JSON.parse(JSON.stringify(glutesProgram));
    } else if (currentProgram === 'fullbody' && !userWorkoutProgram) {
        userWorkoutProgram = JSON.parse(JSON.stringify(workoutProgram));
    }

    [exercises[index], exercises[index + 1]] = [exercises[index + 1], exercises[index]];

    saveUserProgram();
    loadWorkout(currentDay);
    updateAfterEdit();
}

// Обновить после редактирования/удаления/перемещения
function updateAfterEdit() {
    // Обновить список в режиме редактирования если мы на странице "Мой план"
    const myPlanPage = document.getElementById('myPlanPage');
    if (myPlanPage && myPlanPage.classList.contains('active')) {
        refreshEditList();
    }
}

// Завершение тренировки
function completeWorkout() {
    let hasData = false;
    for (let exerciseId in currentWorkoutData) {
        const exercise = currentWorkoutData[exerciseId];
        if (exercise.sets && exercise.sets.length > 0) {
            const validSets = exercise.sets.filter(set => set && (set.weight || set.reps));
            if (validSets.length > 0) {
                hasData = true;
                break;
            }
        }
    }

    if (!hasData) {
        tg.showAlert('⚠️ Заполните хотя бы одно упражнение!');
        return;
    }

    const program = getCurrentProgram();
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    const workoutRecord = {
        date: now.toISOString(),
        dateOnly: today, // Для проверки дубликатов
        dateFormatted: now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        day: currentDay,
        dayName: program[currentDay].name,
        program: currentProgram,
        exercises: JSON.parse(JSON.stringify(currentWorkoutData)) // Глубокая копия
    };

    let history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');

    // Проверить, есть ли уже тренировка за сегодня
    const existingIndex = history.findIndex(record => record.dateOnly === today);

    if (existingIndex !== -1) {
        // Объединить данные с существующей тренировкой
        const existing = history[existingIndex];

        // Merge упражнений - обновить существующие или добавить новые
        for (let exerciseId in workoutRecord.exercises) {
            if (existing.exercises[exerciseId]) {
                // Обновить существующее упражнение
                existing.exercises[exerciseId] = workoutRecord.exercises[exerciseId];
            } else {
                // Добавить новое упражнение
                existing.exercises[exerciseId] = workoutRecord.exercises[exerciseId];
            }
        }

        // Обновить метаданные
        existing.date = workoutRecord.date;
        existing.dateFormatted = workoutRecord.dateFormatted;
        existing.day = workoutRecord.day;
        existing.dayName = workoutRecord.dayName;
        existing.program = workoutRecord.program;

        history[existingIndex] = existing;
    } else {
        // Добавить новую запись
        history.unshift(workoutRecord);
    }

    localStorage.setItem('workoutHistory', JSON.stringify(history));

    // Очистить текущую тренировку
    clearCurrentWorkoutInProgress();
    currentWorkoutData = {};

    tg.showAlert('✅ Тренировка сохранена!', function() {
        switchPage('mainMenu');
    });
}

// Загрузка истории
function loadHistory() {
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
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
        const date = new Date(record.date);
        const dateStr = date.toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        html += `
            <details class="card-modern mb-4">
                <summary class="cursor-pointer flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-bold" style="background: var(--primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${dateStr}</h3>
                        <p class="text-sm opacity-70 mt-1">${record.dayName}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="event.stopPropagation(); editHistoryWorkout(${recordIndex})" class="text-xl opacity-70 hover:opacity-100">✏️</button>
                        <span class="text-xl arrow">▼</span>
                    </div>
                </summary>
                <div class="mt-4 pt-4 border-t border-white border-opacity-10 space-y-3" id="history-${recordIndex}">
        `;

        for (let exerciseId in record.exercises) {
            const exercise = record.exercises[exerciseId];
            if (exercise.sets && exercise.sets.length > 0) {
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

                    html += `
                            </div>
                        </div>
                    `;
                }
            }
        }

        html += `
                </div>
            </details>
        `;
    });

    container.innerHTML = html;
}

// Редактировать тренировку из истории
function editHistoryWorkout(recordIndex) {
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    const record = history[recordIndex];

    if (!record) return;

    // Открыть модальное окно редактирования истории
    document.getElementById('editHistoryModal').classList.add('active');
    document.getElementById('editHistoryIndex').value = recordIndex;

    // Заполнить данные
    const container = document.getElementById('editHistoryExercises');
    let html = `<h3 class="text-lg font-bold mb-3">${record.dayName}</h3>`;

    for (let exerciseId in record.exercises) {
        const exercise = record.exercises[exerciseId];
        if (exercise.sets && exercise.sets.length > 0) {
            html += `
                <div class="card-modern mb-3">
                    <div class="font-semibold mb-2">${exercise.name}</div>
                    <div class="space-y-2">
            `;

            exercise.sets.forEach((set, setIndex) => {
                if (set && (set.weight || set.reps)) {
                    html += `
                        <div class="grid grid-cols-3 gap-2">
                            <span class="text-sm opacity-70 flex items-center">Подход ${setIndex + 1}</span>
                            <input type="number" value="${set.weight || ''}" placeholder="Вес"
                                   class="input-modern text-sm"
                                   data-exercise="${exerciseId}"
                                   data-set="${setIndex}"
                                   data-field="weight">
                            <input type="number" value="${set.reps || ''}" placeholder="Повт"
                                   class="input-modern text-sm"
                                   data-exercise="${exerciseId}"
                                   data-set="${setIndex}"
                                   data-field="reps">
                        </div>
                    `;
                }
            });

            html += `
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = html;
}

// Сохранить изменения в истории
function saveHistoryEdit() {
    const recordIndex = parseInt(document.getElementById('editHistoryIndex').value);
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    const record = history[recordIndex];

    if (!record) return;

    // Собрать обновленные данные из инпутов
    const inputs = document.querySelectorAll('#editHistoryExercises input');
    inputs.forEach(input => {
        const exerciseId = input.dataset.exercise;
        const setIndex = parseInt(input.dataset.set);
        const field = input.dataset.field;
        const value = input.value;

        if (record.exercises[exerciseId] && record.exercises[exerciseId].sets[setIndex]) {
            record.exercises[exerciseId].sets[setIndex][field] = value;
        }
    });

    // Сохранить обновленную историю
    history[recordIndex] = record;
    localStorage.setItem('workoutHistory', JSON.stringify(history));

    closeEditHistoryModal();
    loadHistory();

    tg.showAlert('✅ Изменения сохранены!');
}

// Закрыть модальное окно редактирования истории
function closeEditHistoryModal() {
    document.getElementById('editHistoryModal').classList.remove('active');
}

// Загрузка прогресса
function loadProgress() {
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');

    document.getElementById('totalWorkouts').textContent = history.length;

    let streak = 0;
    if (history.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < history.length; i++) {
            const workoutDate = new Date(history[i].date);
            workoutDate.setHours(0, 0, 0, 0);

            const diffDays = Math.floor((today - workoutDate) / (1000 * 60 * 60 * 24));

            if (diffDays === i) {
                streak++;
            } else {
                break;
            }
        }
    }
    document.getElementById('currentStreak').textContent = streak;

    // Установить активную программу
    const progressProgram = localStorage.getItem('progressProgram') || 'fullbody';
    switchProgressProgram(progressProgram);
}

// Переключение программы в прогрессе
function switchProgressProgram(program) {
    localStorage.setItem('progressProgram', program);

    // Обновить активную кнопку
    document.querySelectorAll('.program-btn').forEach(btn => btn.classList.remove('active'));
    if (program === 'fullbody') {
        document.getElementById('progressFullbodyBtn').classList.add('active');
    } else {
        document.getElementById('progressGlutesBtn').classList.add('active');
    }

    loadProgressExercises(program);
}

// Загрузка упражнений с максимальными весами
function loadProgressExercises(program) {
    const history = JSON.parse(localStorage.getItem('workoutHistory') || '[]');
    const container = document.getElementById('progressExercisesList');

    // Фильтровать историю по программе
    const programHistory = history.filter(record => record.program === program);

    if (programHistory.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 opacity-50">
                <div class="text-3xl mb-2">📊</div>
                <p>Нет данных по этой программе</p>
                <p class="text-sm mt-1">Начни тренироваться!</p>
            </div>
        `;
        return;
    }

    // Получить программу
    const programData = program === 'glutes' ? glutesProgram : workoutProgram;

    // Собрать максимальные веса для каждого упражнения
    const exerciseMaxWeights = {};

    programHistory.forEach(record => {
        for (let exerciseId in record.exercises) {
            const exercise = record.exercises[exerciseId];
            const sets = exercise.sets || [];
            const maxWeight = Math.max(...sets.map(s => parseFloat(s.weight) || 0));

            if (maxWeight > 0) {
                if (!exerciseMaxWeights[exerciseId] || maxWeight > exerciseMaxWeights[exerciseId]) {
                    exerciseMaxWeights[exerciseId] = maxWeight;
                }
            }
        }
    });

    // Отобразить упражнения по дням
    let html = '<h3 class="text-lg font-bold mb-3" style="background: var(--primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Максимальные веса</h3>';

    ['A', 'B', 'C'].forEach(day => {
        if (programData[day]) {
            html += `
                <div class="mb-4">
                    <h4 class="text-base font-semibold mb-2 opacity-80">${programData[day].emoji} ${programData[day].name}</h4>
                    <div class="space-y-2">
            `;

            programData[day].exercises.forEach(exercise => {
                const maxWeight = exerciseMaxWeights[exercise.id] || 0;
                html += `
                    <div class="bg-white bg-opacity-5 rounded-xl p-3 flex justify-between items-center">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">${exercise.emoji}</span>
                            <span class="text-sm">${exercise.name}</span>
                        </div>
                        <div class="text-right">
                            ${maxWeight > 0 ? `<div class="text-lg font-bold" style="background: var(--primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${maxWeight} кг</div>` : '<div class="text-sm opacity-50">—</div>'}
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html;
}

// Загрузка справочника упражнений
function loadExercisesGuide() {
    const container = document.getElementById('exercisesGuide');

    const categories = {};
    allExercises.forEach(exercise => {
        if (!categories[exercise.category]) {
            categories[exercise.category] = [];
        }
        categories[exercise.category].push(exercise);
    });

    let html = '';

    Object.keys(categories).forEach(category => {
        html += `
            <div class="mb-6">
                <h3 class="text-xl font-bold mb-4" style="background: var(--primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${category}</h3>
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
                        <a href="${exercise.youtubeUrl}" target="_blank" class="youtube-link">
                            ▶️ Видео
                        </a>
                    </div>
                    ${exercise.muscleGroups ? `<div class="text-sm opacity-70 ml-11">${exercise.muscleGroups}</div>` : ''}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Загрузка страницы AI Тренера
function loadAITrainerPage() {
    // Загрузить сохраненные данные если есть
    const savedData = localStorage.getItem('aiTrainerData');
    if (savedData) {
        const data = JSON.parse(savedData);
        document.getElementById('aiGender').value = data.gender || 'Мужской';
        document.getElementById('aiAge').value = data.age || '';
        document.getElementById('aiWeight').value = data.weight || '';
        document.getElementById('aiHeight').value = data.height || '';
        document.getElementById('aiExperience').value = data.experience || 'Новичок (0-6 месяцев)';
        document.getElementById('aiGoal').value = data.goal || 'Набор мышечной массы';
        document.getElementById('aiEquipment').value = data.equipment || 'Полный зал (штанги, гантели, тренажеры)';
        document.getElementById('aiPreferredExercises').value = data.preferredExercises || '';

        // Восстановить выбранные области фокуса
        if (data.focusAreas && data.focusAreas.length > 0) {
            const select = document.getElementById('aiFocusAreas');
            for (let option of select.options) {
                option.selected = data.focusAreas.includes(option.value);
            }
        }
    }
}

// Генерация плана тренировок через AI
async function generateAIPlan() {
    const gender = document.getElementById('aiGender').value;
    const age = document.getElementById('aiAge').value;
    const weight = document.getElementById('aiWeight').value;
    const height = document.getElementById('aiHeight').value;
    const experience = document.getElementById('aiExperience').value;
    const goal = document.getElementById('aiGoal').value;
    const equipment = document.getElementById('aiEquipment').value;
    const preferredExercises = document.getElementById('aiPreferredExercises').value.trim();

    // Получить выбранные области фокуса
    const focusAreasSelect = document.getElementById('aiFocusAreas');
    const focusAreas = Array.from(focusAreasSelect.selectedOptions).map(option => option.value);

    if (!age || !weight || !height) {
        tg.showAlert('⚠️ Заполни все поля!');
        return;
    }

    // Сохранить данные
    localStorage.setItem('aiTrainerData', JSON.stringify({
        gender, age, weight, height, experience, goal, equipment, preferredExercises, focusAreas
    }));

    const btn = document.getElementById('generateBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Генерирую план...';
    btn.disabled = true;

    try {
        const apiUrl = 'https://training-bot-ebon.vercel.app/api/workout-plan';

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gender, age, weight, height, experience, goal, equipment, preferredExercises, focusAreas
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка API');
        }

        const data = await response.json();

        // Проверить формат ответа
        if (data.isText) {
            // Старый текстовый формат
            document.getElementById('aiPlanContent').textContent = data.plan;

            localStorage.setItem('lastGeneratedAIPlan', JSON.stringify({
                plan: data.plan,
                isText: true,
                userData: { gender, age, weight, height, experience, goal, equipment, preferredExercises, focusAreas },
                timestamp: new Date().toISOString()
            }));
        } else {
            // Новый JSON формат
            const planText = formatPlanAsText(data.plan);
            document.getElementById('aiPlanContent').textContent = planText;

            localStorage.setItem('lastGeneratedAIPlan', JSON.stringify({
                plan: data.plan,
                isText: false,
                userData: { gender, age, weight, height, experience, goal, equipment, preferredExercises, focusAreas },
                timestamp: new Date().toISOString()
            }));
        }

        // Показать результат
        document.getElementById('aiPlanResult').classList.remove('hidden');

        // Прокрутить к результату
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

// Форматировать JSON план в текст для отображения
function formatPlanAsText(plan) {
    let text = '';

    ['A', 'B', 'C'].forEach(day => {
        if (plan[day]) {
            text += `\n${plan[day].emoji} ${plan[day].name}\n`;
            text += '─'.repeat(40) + '\n\n';

            plan[day].exercises.forEach((ex, index) => {
                text += `${index + 1}. ${ex.emoji} ${ex.name}\n`;
                text += `   Подходы: ${ex.sets} x ${ex.reps}\n`;
                text += `   Техника: ${ex.technique}\n\n`;
            });
        }
    });

    if (plan.nutrition) {
        text += '\n🍎 Питание\n';
        text += '─'.repeat(40) + '\n';
        text += plan.nutrition + '\n\n';
    }

    if (plan.rest) {
        text += '\n😴 Отдых\n';
        text += '─'.repeat(40) + '\n';
        text += plan.rest + '\n';
    }

    return text;
}

// Сохранить AI план в тренировки
function saveAIPlanToWorkouts() {
    const lastPlan = localStorage.getItem('lastGeneratedAIPlan');
    if (!lastPlan) {
        tg.showAlert('⚠️ Нет сгенерированного плана');
        return;
    }

    const planData = JSON.parse(lastPlan);

    // Проверить формат плана
    if (planData.isText) {
        tg.showAlert('⚠️ Этот план в старом формате. Сгенерируй новый план для сохранения.');
        return;
    }

    // Получить существующие AI планы
    let aiPlans = JSON.parse(localStorage.getItem('aiWorkoutPlans') || '[]');

    // Создать новый план в формате программы
    const newPlan = {
        id: 'ai_' + Date.now(),
        name: `AI План - ${planData.userData.goal}`,
        description: `Пол: ${planData.userData.gender}, Возраст: ${planData.userData.age}, Опыт: ${planData.userData.experience}`,
        program: planData.plan, // JSON структура с днями A, B, C
        userData: planData.userData,
        createdAt: planData.timestamp
    };

    aiPlans.push(newPlan);
    localStorage.setItem('aiWorkoutPlans', JSON.stringify(aiPlans));

    tg.showAlert('✅ План добавлен в Тренировки!');
}

// Загрузка экрана выбора программы тренировок
function loadWorkoutProgramSelection() {
    // Показать экран выбора программы
    document.getElementById('workoutProgramSelection').classList.remove('hidden');
    document.getElementById('workoutDaySelection').classList.add('hidden');

    // Загрузить AI планы
    const aiPlans = JSON.parse(localStorage.getItem('aiWorkoutPlans') || '[]');
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

// Выбор программы тренировок
function selectWorkoutProgram(programId) {
    if (programId === 'fullbody' || programId === 'glutes') {
        // Стандартные программы
        currentProgram = programId;
        document.getElementById('workoutProgramSelection').classList.add('hidden');
        document.getElementById('workoutDaySelection').classList.remove('hidden');

        // Обновить название программы
        const programName = programId === 'fullbody' ? '💪 Full Body' : '🍑 Ягодицы';
        document.getElementById('currentProgramName').textContent = programName;

        updateDate();
        updateProgramButtons();
        selectDay('A');
    } else {
        // AI план - загрузить как программу
        loadAIPlanAsProgram(programId);
    }
}

// Загрузить AI план как программу тренировок
function loadAIPlanAsProgram(planId) {
    const aiPlans = JSON.parse(localStorage.getItem('aiWorkoutPlans') || '[]');
    const plan = aiPlans.find(p => p.id === planId);

    if (!plan) {
        tg.showAlert('⚠️ План не найден');
        return;
    }

    // Установить AI план как текущую программу
    currentProgram = planId;

    // Создать временную программу из AI плана
    userWorkoutProgram = plan.program;

    // Переключиться на экран тренировки
    document.getElementById('workoutProgramSelection').classList.add('hidden');
    document.getElementById('workoutDaySelection').classList.remove('hidden');

    // Обновить название программы
    document.getElementById('currentProgramName').textContent = `🤖 ${plan.name.replace('AI План - ', '')}`;

    updateDate();
    selectDay('A');
}

// Удалить AI план
function deleteAIPlan(planId) {
    let aiPlans = JSON.parse(localStorage.getItem('aiWorkoutPlans') || '[]');
    aiPlans = aiPlans.filter(p => p.id !== planId);
    localStorage.setItem('aiWorkoutPlans', JSON.stringify(aiPlans));
    loadWorkoutProgramSelection();
    tg.showAlert('✅ План удалён');
}

// Вернуться к выбору программы
function backToProgramSelection() {
    document.getElementById('workoutProgramSelection').classList.remove('hidden');
    document.getElementById('workoutDaySelection').classList.add('hidden');
}

// Скрыть клавиатуру на мобильных устройствах
function hideKeyboard() {
    // Убрать фокус с активного элемента
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        document.activeElement.blur();
    }

    // Скрыть кнопку "Готово"
    document.getElementById('keyboardDoneBtn').classList.remove('active');
}

// Скрыть клавиатуру через кнопку
function hideKeyboardWithButton() {
    hideKeyboard();
}

// Показать кнопку "Готово" когда поле в фокусе
function showKeyboardDoneButton() {
    document.getElementById('keyboardDoneBtn').classList.add('active');
}

// Добавить обработчики для автоматического скрытия клавиатуры
function setupKeyboardHandlers() {
    // Показать кнопку "Готово" при фокусе на input/textarea
    document.addEventListener('focusin', (e) => {
        if (e.target.matches('input, textarea')) {
            showKeyboardDoneButton();
        }
    });

    // Скрыть кнопку "Готово" при потере фокуса
    document.addEventListener('focusout', (e) => {
        if (e.target.matches('input, textarea')) {
            setTimeout(() => {
                // Проверить, что фокус не перешёл на другой input
                if (!document.activeElement || !document.activeElement.matches('input, textarea')) {
                    hideKeyboard();
                }
            }, 100);
        }
    });

    // При клике по любому месту на странице (кроме input/textarea) - скрыть клавиатуру
    document.addEventListener('click', (e) => {
        if (!e.target.matches('input, textarea')) {
            hideKeyboard();
        }
    });
}

// PWA: Показать кнопку установки приложения
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
});

function showInstallButton() {
    // Показать кнопку установки только если не в Telegram
    if (!window.Telegram?.WebApp) {
        const installBtn = document.createElement('button');
        installBtn.id = 'installBtn';
        installBtn.className = 'btn-modern';
        installBtn.style.cssText = 'position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 1000; background: var(--primary); color: white; padding: 12px 24px; border-radius: 12px; font-weight: bold; box-shadow: var(--shadow-lg);';
        installBtn.textContent = '📱 Установить приложение';
        installBtn.onclick = installApp;
        document.body.appendChild(installBtn);
    }
}

async function installApp() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
        console.log('Приложение установлено');
    }

    deferredPrompt = null;
    document.getElementById('installBtn')?.remove();
}

function showInstallPrompt() {
    // iOS Safari не поддерживает beforeinstallprompt
    // Показать инструкцию для iOS
    if (!window.Telegram?.WebApp && /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone) {
        const isFirstVisit = !localStorage.getItem('pwaInstructionShown');
        if (isFirstVisit) {
            setTimeout(() => {
                alert('💡 Совет: Добавьте приложение на домашний экран!\n\nНажмите кнопку "Поделиться" внизу Safari и выберите "На экран Домой"');
                localStorage.setItem('pwaInstructionShown', 'true');
            }, 2000);
        }
    }
}

// Запуск при загрузке
window.onload = () => {
    init();
};