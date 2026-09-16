# egogo

API-клиент (альтернатива Postman) на [Wails](https://wails.io) с self-hosted сервером и синхронизацией через Git (todo).

## Структура

```
egogo/
├── client/          # Desktop-приложение (Wails + React)
├── server/          # Self-hosted web-сервер (Go)
├── pkg/             # Общие типы и утилиты
└── docs/            # Архитектура и решения
```

## Быстрый старт

### Клиент

```bash
cd client
wails dev          # разработка с hot-reload
wails build        # сборка бинарника
```

### Сервер

```bash
cd server
go run ./cmd/server
```

Или
```bash
EGOGO_SECRET=some_secret EGOGO_MASTER_KEY=1234567890ABCDEABCDE1234567890FF1234567890ABCDEABCDE1234567890FF go run cmd/server/main.go

```

## Основные концепции

| Концепция     | Описание                                            |
|---------------|-----------------------------------------------------|
| **Профиль**   | Контекст работы: локальный, организация, pet-проект |
| **Проект**    | Основная сущность вместо коллекций Postman          |
| **Окружение** | Набор переменных (как Environments в Postman)       |
| **Запрос**    | HTTP-запрос внутри папки проекта                    |

## Режимы работы

1. **Локально** — без сервера, данные на машине пользователя
2. **Self-hosted** — компания поднимает `server/`, управляет пользователями и правами
3. **Git-sync** — проекты хранятся в репозитории, без обязательного сервера

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/AUTH.md](docs/AUTH.md)
