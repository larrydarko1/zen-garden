# Zen Garden

![License](https://img.shields.io/github/license/larrydarko1/zen-garden)
![Issues](https://img.shields.io/github/issues/larrydarko1/zen-garden)
![Pull Requests](https://img.shields.io/github/issues-pr/larrydarko1/zen-garden)
![Contributors](https://img.shields.io/github/contributors/larrydarko1/zen-garden)

Zen Garden is a simple meditation web app built with the **MEVN Stack** (MongoDB, Express.js, Vue 3, Node.js) and TypeScript. It features guided meditations, a meditation calendar, and relaxing animations.

## Demo

![Zen Garden Demo](./public/demo.gif)

## Tech Stack
- **Frontend:** Vue 3, TypeScript, Vite, SCSS
- **Backend:** Node.js, Express.js, TypeScript
- **Database:** MongoDB
- **Deployment:** Docker, Traefik (reverse proxy with SSL)
- **Authentication:** JWT + Argon2

## Features
- 🧘 Guided meditation audio with ambient soundscapes
- 📅 Meditation calendar tracking
- 📝 Session notes and reflection journaling
- 🫁 Breathing exercises (Box, 4-7-8, Deep, Energizing)
- 🎨 Animated Zen backgrounds (Wind, Waves, Idle)
- 🔐 User authentication and secure data persistence
- 🎭 Three beautiful themes (Blue, White, Dark)
- 📱 Fully responsive mobile design
- ⚡ **Progressive Web App (PWA)** with offline support
- 🔌 **Offline-first capability** - meditate without internet
- 💾 **Smart caching** - instant loading with service workers
- 📲 **Installable** - works like a native app on any device

> **NEW!** Zen Garden is now a fully functional PWA! 

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm
- MongoDB (local or Docker)

### Setup

1. **Clone the repository**
```sh
git clone https://github.com/larrydarko1/zen-garden.git
cd zen-garden
```

2. **Install dependencies**
```sh
npm install
```

3. **Configure environment variables**

Create `.env` file in the root directory:
```sh
cp .env.example .env
```

Create `.env` file in the server directory:
```sh
cp server/.env.example server/.env
```

Update both files with your own values (API keys, MongoDB URI, JWT secret).

4. **Start MongoDB**
```sh
# Using Docker
docker compose -f docker/docker-compose.yml up -d

# Or use local MongoDB installation
mongod
```

### Development
```sh
# Start the frontend dev server (port 3000)
npm run dev

# In another terminal, start the backend server (port 3001)
npm run server
```

Visit http://localhost:3000

### Production Build
```sh
npm run build
npm run preview
```

### Production Deployment with Docker

The application is production-ready with Docker and Traefik for SSL/TLS:

```sh
# Deploy with Docker Compose (includes Traefik reverse proxy)
docker compose -f docker/docker-compose.yml up -d
```

**What's included:**
- Traefik reverse proxy with automatic SSL (Let's Encrypt)
- Frontend (Vue 3) with 2 replicas
- Backend API (Express) with 2 replicas
- MongoDB database with persistent storage
- Internal network isolation for security

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
