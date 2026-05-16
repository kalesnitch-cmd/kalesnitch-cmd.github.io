# 🎨 Дизайн-система Training Bot Mini App

## 📋 Обзор

Этот документ описывает полную дизайн-систему на основе анализа `pitanie.jsx` для переноса стилей на весь Training Bot Mini App.

---

## 🎨 Цветовая палитра

### Основные цвета (Primary Colors)

```css
/* Илюша (оранжевый акцент) */
--ilya-color: #f97316;
--ilya-color-light: #fb923c;
--ilya-bg: rgba(251, 146, 60, 0.1);
--ilya-border: rgba(251, 146, 60, 0.25);

/* Ариша (розовый акцент) */
--arisha-color: #e879f9;
--arisha-color-light: #c084fc;
--arisha-bg: rgba(232, 121, 249, 0.1);
--arisha-border: rgba(232, 121, 249, 0.25);
```

### Типы приёмов пищи (адаптировать для тренировок)

```css
/* Завтрак → Разминка */
--breakfast-color: #fb923c;
--breakfast-bg: rgba(251, 146, 60, 0.1);
--breakfast-border: rgba(251, 146, 60, 0.25);

/* Перекус → Кардио */
--snack-color: #4ade80;
--snack-bg: rgba(74, 222, 128, 0.1);
--snack-border: rgba(74, 222, 128, 0.25);

/* Обед → Основная тренировка */
--lunch-color: #60a5fa;
--lunch-bg: rgba(96, 165, 250, 0.1);
--lunch-border: rgba(96, 165, 250, 0.25);

/* Ужин → Заминка */
--dinner-color: #c084fc;
--dinner-bg: rgba(192, 132, 252, 0.1);
--dinner-border: rgba(192, 132, 252, 0.25);
```

### Фоновые цвета

```css
--bg-primary: #030508;
--bg-secondary: #070c14;
--bg-tertiary: #04080f;

/* Градиент фона */
background: linear-gradient(170deg, #030508 0%, #070c14 55%, #04080f 100%);
```

### Текстовые цвета

```css
--text-primary: #f9fafb;    /* Основной текст */
--text-secondary: #4b5563;  /* Вторичный текст */
--text-tertiary: #374151;   /* Третичный текст */
--text-muted: #d1d5db;      /* Приглушённый текст */
```

### Акцентные цвета

```css
--accent-yellow: #fbbf24;   /* Калории/важные числа */
--accent-blue: #60a5fa;     /* Белок */
--accent-orange: #fb923c;   /* Жиры */
--accent-green: #4ade80;    /* Углеводы */
--accent-red: #f87171;      /* Ошибки/превышение */
```

### Прозрачности и границы

```css
--card-bg: rgba(255, 255, 255, 0.02);
--card-bg-hover: rgba(255, 255, 255, 0.04);
--card-border: rgba(255, 255, 255, 0.055);
--card-border-hover: rgba(255, 255, 255, 0.08);

--input-bg: rgba(255, 255, 255, 0.05);
--input-border: rgba(255, 255, 255, 0.1);
```

---

## 📐 Типографика

### Шрифты

```css
/* Основной шрифт для текста */
font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;

/* Шрифт для заголовков и акцентов */
font-family: 'Unbounded', 'Manrope', sans-serif;
```

### Подключение шрифтов

```html
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

### Размеры шрифтов

```css
/* Заголовки */
--font-size-h1: 28px;        /* font-weight: 900 */
--font-size-h2: 15-16px;     /* font-weight: 800 */
--font-size-h3: 12px;        /* font-weight: 800 */

/* Основной текст */
--font-size-base: 12px;      /* font-weight: 500-700 */
--font-size-small: 11px;     /* font-weight: 500-700 */
--font-size-tiny: 10px;      /* font-weight: 700-800 */
--font-size-micro: 9px;      /* font-weight: 700-800 */
--font-size-nano: 8px;       /* font-weight: 700 */

/* Числа и метрики */
--font-size-metric-large: 16px;  /* font-weight: 900, Unbounded */
--font-size-metric-medium: 14-15px; /* font-weight: 900, Unbounded */
--font-size-metric-small: 12px;  /* font-weight: 800-900, Unbounded */
```

### Веса шрифтов

```css
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--font-weight-extrabold: 800;
--font-weight-black: 900;
```

---

## 🔲 Радиусы скругления

```css
--radius-xs: 5px;    /* Маленькие чипы */
--radius-sm: 7px;    /* Маленькие элементы */
--radius-md: 9-12px; /* Средние карточки */
--radius-lg: 14-17px;/* Большие карточки */
--radius-xl: 20-26px;/* Модальные окна */
```

---

## 🎯 Компоненты

### 1. Кнопки

#### Основная кнопка (Primary Button)

```css
.btn-primary {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-color)cc);
  border: none;
  border-radius: 10-12px;
  padding: 7-8px 11-14px;
  font-weight: 800;
  font-size: 10-13px;
  font-family: 'Manrope', sans-serif;
  color: #030508;
  cursor: pointer;
  box-shadow: 0 2px 10px var(--primary-glow);
  transition: all 0.15s;
}

.btn-primary:hover {
  box-shadow: 0 4px 16px var(--primary-glow);
}

.btn-primary:active {
  transform: scale(0.98);
}
```

#### Кнопка переключения (Toggle Button)

```css
.btn-toggle {
  border: 1.5px solid var(--border-color);
  background: rgba(255, 255, 255, 0.03);
  color: #374151;
  border-radius: 12px;
  padding: 8px 18px;
  font-weight: 800;
  font-size: 13px;
  font-family: 'Manrope', sans-serif;
  transition: all 0.2s;
}

.btn-toggle.active {
  border-color: var(--accent-color);
  background: var(--accent-bg);
  color: var(--accent-color);
  box-shadow: 0 0 20px var(--accent-glow);
}
```

#### Кнопка дня недели

```css
.day-btn {
  border: none;
  border-radius: 11px;
  padding: 9px 3px;
  background: rgba(255, 255, 255, 0.04);
  color: #374151;
  font-weight: 500;
  font-family: 'Manrope', sans-serif;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.day-btn.active {
  background: linear-gradient(145deg, var(--accent-color), var(--accent-color)aa);
  color: #030508;
  font-weight: 800;
  box-shadow: 0 4px 16px var(--accent-glow);
}
```

### 2. Карточки

#### Основная карточка

```css
.card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.055);
  border-radius: 17px;
  padding: 13-14px;
  transition: all 0.15s;
}

.card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}
```

#### Карточка с градиентом

```css
.card-gradient {
  background: linear-gradient(135deg, var(--accent-bg), var(--accent-bg-light));
  border: 1px solid var(--accent-border);
  border-radius: 12-20px;
  padding: 16-18px;
}
```

#### Карточка упражнения/блюда

```css
.meal-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.055);
  border-radius: 17px;
  overflow: hidden;
}

.meal-card-header {
  display: flex;
  align-items: center;
  padding: 13px 14px;
  gap: 10px;
}

.meal-card-footer {
  display: flex;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.meal-card-stat {
  flex: 1;
  text-align: center;
  padding: 6px 0;
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 11px;
  font-family: 'Manrope', sans-serif;
}

.meal-card-stat:last-child {
  border-right: none;
}
```

### 3. Иконки и эмодзи

```css
.icon-container {
  width: 40-48px;
  height: 40-48px;
  border-radius: 12-14px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18-22px;
}
```

### 4. Чипы и бейджи

```css
.chip {
  font-size: 9-10px;
  font-weight: 700;
  color: var(--chip-color);
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  border-radius: 5-7px;
  padding: 1-4px 6-10px;
  font-family: 'Manrope', sans-serif;
  display: inline-block;
}
```

### 5. Прогресс-бары

```css
.progress-bar-container {
  height: 3-4px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
}

.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s;
}

/* Макронутриенты */
.progress-protein { background: #60a5fa; }
.progress-fat { background: #fb923c; }
.progress-carbs { background: #4ade80; }
```

### 6. Инпуты

```css
.input {
  background: rgba(255, 255, 255, 0.05);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 9-12px;
  padding: 8-13px 10-14px;
  color: var(--text-primary);
  font-size: 11-15px;
  font-weight: 500;
  font-family: 'Manrope', sans-serif;
  transition: all 0.2s;
  outline: none;
}

.input:focus {
  border-color: var(--accent-color);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
```

### 7. Модальные окна

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-content {
  background: linear-gradient(160deg, #0b1520 0%, #060e18 100%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 26px;
  width: 100%;
  max-width: 620px;
  max-height: 88vh;
  overflow-y: auto;
  box-shadow: 0 48px 120px rgba(0, 0, 0, 0.95);
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.05) transparent;
}

.modal-header {
  padding: 20px 22px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  position: sticky;
  top: 0;
  z-index: 10;
  background: linear-gradient(160deg, #0b1520, #060e18);
  border-radius: 26px 26px 0 0;
}
```

### 8. Хедер (Sticky Header)

```css
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  backdrop-filter: blur(24px);
  background: rgba(3, 5, 8, 0.96);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.header-content {
  max-width: 640px;
  margin: 0 auto;
  padding: 0 18px;
}

.header-top {
  padding-top: 14px;
  padding-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-tabs {
  display: flex;
  gap: 2px;
}

.header-tab {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 14px 13px;
  color: #374151;
  font-weight: 500;
  font-size: 12px;
  font-family: 'Manrope', sans-serif;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.header-tab.active {
  color: var(--accent-color);
  font-weight: 700;
  border-bottom-color: var(--accent-color);
}
```

### 9. Секции с заголовками

```css
.section-label {
  font-size: 10px;
  font-weight: 800;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-family: 'Manrope', sans-serif;
  margin-bottom: 9px;
}
```

### 10. Итоговые блоки (Summary Cards)

```css
.summary-card {
  background: linear-gradient(135deg, var(--accent-bg), var(--accent-bg-light));
  border: 1px solid var(--accent-border);
  border-radius: 20px;
  padding: 16px 18px;
}

.summary-metric {
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  font-family: 'Unbounded', sans-serif;
  color: var(--metric-color);
}

.summary-label {
  font-size: 9px;
  color: #374151;
  letter-spacing: 1.5px;
  font-weight: 700;
  text-transform: uppercase;
  font-family: 'Manrope', sans-serif;
  margin-bottom: 4px;
}
```

---

## 🎭 Анимации и переходы

### Стандартные переходы

```css
transition: all 0.15s;  /* Быстрые элементы (кнопки, ховеры) */
transition: all 0.2s;   /* Средние элементы (инпуты) */
transition: all 0.4s;   /* Медленные элементы (прогресс-бары) */
```

### Анимация появления

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.2s;
}
```

### Анимация пульсации

```css
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.1); opacity: 0.5; }
}
```

---

## 📱 Адаптивность

### Максимальная ширина контейнера

```css
.container {
  max-width: 640px;
  margin: 0 auto;
  padding: 20px 18px 0;
  position: relative;
  z-index: 1;
}
```

### Отступы

```css
--spacing-xs: 3px;
--spacing-sm: 5-8px;
--spacing-md: 10-14px;
--spacing-lg: 16-20px;
--spacing-xl: 24-28px;
```

---

## 🎨 Градиенты и эффекты

### Фоновый градиент с сиянием

```css
body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse 55% 30% at 8% 0%, var(--accent-glow) 0%, transparent 55%);
  pointer-events: none;
  z-index: 0;
  transition: background 0.4s;
}
```

### Градиенты для кнопок

```css
background: linear-gradient(135deg, var(--color-start), var(--color-end));
background: linear-gradient(145deg, var(--color-start), var(--color-end)aa);
```

### Тени

```css
--shadow-sm: 0 2px 10px var(--accent-glow);
--shadow-md: 0 4px 16px var(--accent-glow);
--shadow-lg: 0 48px 120px rgba(0, 0, 0, 0.95);
```

---

## 🔧 Утилиты

### Скрытие элементов

```css
.hidden {
  display: none !important;
}
```

### Скроллбар

```css
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}
```

### Отключение выделения

```css
-webkit-tap-highlight-color: transparent;
user-select: none;
```

---

## 📊 Примеры использования

### Карточка тренировки (аналог карточки блюда)

```html
<div class="meal-card">
  <div class="meal-card-header">
    <div class="icon-container">🏋️</div>
    <div style="flex: 1; min-width: 0;">
      <span class="chip">Основная тренировка</span>
      <div class="exercise-name">Жим штанги лёжа</div>
    </div>
    <div style="text-align: right;">
      <div class="summary-metric" style="font-size: 14px;">4×8</div>
      <div style="font-size: 8px; color: #374151;">ПОДХОДЫ</div>
    </div>
    <button class="btn-primary">Начать →</button>
  </div>
  <div class="meal-card-footer">
    <div class="meal-card-stat">
      <span style="color: #374151;">Вес </span>
      <span style="color: #60a5fa; font-weight: 700;">80кг</span>
    </div>
    <div class="meal-card-stat">
      <span style="color: #374151;">Отдых </span>
      <span style="color: #fb923c; font-weight: 700;">2мин</span>
    </div>
    <div class="meal-card-stat">
      <span style="color: #374151;">Темп </span>
      <span style="color: #4ade80; font-weight: 700;">3-1-1</span>
    </div>
  </div>
</div>
```

### Итоговая карточка дня

```html
<div class="summary-card">
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
    <div>
      <div class="summary-label">День 1 · Илюша</div>
      <div class="summary-metric" style="color: #4ade80;">
        12<span style="font-size: 13px; margin-left: 4px; opacity: 0.7;">упр</span>
      </div>
      <div style="font-size: 10px; color: #4ade80; margin-top: 3px;">✓ план выполнен</div>
    </div>
    <div style="display: flex; gap: 7px;">
      <div style="text-align: center; background: #60a5fa0e; border: 1px solid #60a5fa40; border-radius: 10px; padding: 6px 10px;">
        <div style="font-size: 15px; font-weight: 900; color: #60a5fa; font-family: 'Unbounded', sans-serif;">45</div>
        <div style="font-size: 8px; color: #374151; font-weight: 700; text-transform: uppercase;">МИН</div>
      </div>
    </div>
  </div>
</div>
```

---

## ✅ Чек-лист переноса дизайна

### Глобальные изменения
- [ ] Обновить CSS переменные в `:root`
- [ ] Подключить шрифты Unbounded и Manrope
- [ ] Обновить фоновый градиент
- [ ] Добавить радиальное сияние `body::before`

### Компоненты
- [ ] Переделать все кнопки под новый стиль
- [ ] Обновить карточки упражнений
- [ ] Переделать хедер (sticky с blur)
- [ ] Обновить модальные окна
- [ ] Переделать инпуты
- [ ] Обновить прогресс-бары
- [ ] Добавить чипы для категорий

### Типографика
- [ ] Заменить все заголовки на Unbounded
- [ ] Обновить размеры шрифтов
- [ ] Добавить правильные веса шрифтов
- [ ] Обновить цвета текста

### Детали
- [ ] Обновить радиусы скругления
- [ ] Добавить правильные тени
- [ ] Обновить анимации и переходы
- [ ] Добавить hover-эффекты
- [ ] Обновить скроллбар

---

## 🎯 Ключевые принципы дизайна

1. **Тёмная тема**: Все элементы на тёмном фоне с минимальной прозрачностью
2. **Градиенты**: Используются для акцентов и активных состояний
3. **Скругления**: Все элементы имеют мягкие скругления (9-26px)
4. **Типографика**: Unbounded для заголовков и чисел, Manrope для текста
5. **Цветовые акценты**: Яркие цвета только для важных элементов
6. **Прозрачность**: Карточки и элементы используют rgba с низкой прозрачностью
7. **Анимации**: Быстрые и плавные переходы (0.15-0.4s)
8. **Иконки**: Эмодзи в контейнерах с фоном и границей
9. **Spacing**: Консистентные отступы (3-28px)
10. **Blur эффекты**: Backdrop-filter для хедера и модальных окон

---

## 📝 Примечания

- Все цвета должны быть в формате HEX или rgba
- Используйте CSS переменные для консистентности
- Все анимации должны быть плавными
- Мобильная оптимизация обязательна
- Accessibility: контрастность текста минимум 4.5:1

---

**Версия**: 1.0  
**Дата**: 2026-05-16  
**Автор**: Claude Code
