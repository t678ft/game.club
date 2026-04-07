# game.club

Статический сайт для GitHub Pages.

## Общая синхронизация броней

Чтобы брони были общими для всех устройств, нужен Supabase.

1. Создайте проект в Supabase.
2. Откройте `SQL Editor`.
3. Выполните содержимое файла `supabase-schema.sql`.
4. Откройте `Project Settings` -> `API`.
5. Скопируйте:
   - `Project URL`
   - `anon public key`
6. Откройте файл `supabase-config.js`.
7. Подставьте значения:

```js
window.GAMECLUB_SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
window.GAMECLUB_SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
```

8. Загрузите обновлённые файлы в GitHub и снова сделайте `push`.

После этого:
- занятые ПК будут видны на всех устройствах
- просроченные брони будут очищаться автоматически
- сайт перестанет работать только через локальный `localStorage`

## Публикация

1. Создайте новый репозиторий на GitHub.
2. Загрузите в него все файлы из этой папки.
3. Откройте `Settings` -> `Pages`.
4. В `Build and deployment` выберите:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
5. Сохраните настройки.

Через несколько минут сайт появится по адресу:

`https://ВАШ-ЛОГИН.github.io/ИМЯ-РЕПОЗИТОРИЯ/`

## Структура

- `index.html` — главная страница
- `styles.css` — стили
- `script.js` — логика бронирования
- `assets/` — изображения
