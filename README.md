# 🚀 Trivia World: Real-Time Multiplayer Trivia Platform  

*Trivia World* is a fast, full-stack trivia app built to show real skill in handling **real-time systems**, **scalable cloud architecture**, and **secure, smooth user experiences**. The whole thing was made to prove that I can build something reliable, quick, and data-driven — the kind of app that actually holds up under pressure.  

---

## ✨ What Makes It Tick  

This app pulls together a modern stack and pushes it pretty far.  

### 1. Real-Time Gameplay (Socket.IO + Node.js)  

* **Instant Game Sync:** I built a custom Node.js and Express backend (`server.ts`) that uses **Socket.IO** to keep every player’s screen perfectly in sync — every tap, every answer, updated in real time with almost no delay.  

* **Smart Game Flow:** The logic runs like a state machine — clean and predictable. From creating a lobby (`create-game`) to players joining (`join-game`), sending questions, and checking answers the moment everyone locks in, it all just flows.  

* **Stay Connected:** Players can drop out and jump back in without losing progress. And if the host disconnects, another player automatically takes over. No broken games, no frustration.  

* **Performance First:** Core game data lives in an in-memory dictionary (`games: Record<string, Game>`), which keeps everything lightning fast by skipping unnecessary database calls.  

### 2. Secure Backend + Data Layer (Supabase)  

* **Authentication That Just Works:** Used **Supabase Auth** for simple email/password signups and quick **Google OAuth 2.0** logins — secure and modern.  

* **Data You Can Trust:** Player stats and scores are updated through PostgreSQL **RPC** calls (`update_solo_stats`, `update_multiplayer_game_stats`), which means every update is handled safely and consistently.  

* **Avatar Uploads, Done Right:** Built a smooth system for players to upload and manage avatars with client-side compression, **Supabase Storage**, and cleanup logic for unused files — so it stays tidy behind the scenes.  

### 3. Smooth Frontend & User Experience (Next.js 15 + React 19)  

* **Modern React Setup:** Everything runs on the **Next.js App Router** and **React 19**, with hooks like `useAuth` and `useAlert`, plus smart code-splitting for speed.  

* **Player Stats Dashboard:** There’s a full profile page (`src/app/profile/page.tsx`) that actually shows something useful — accuracy by difficulty, win/loss ratios, and more. It’s all there to keep players hooked.  

* **Looks Good Everywhere:** Styled with **Tailwind CSS 4**, so the app fits cleanly on any screen — big, small, or in-between — without breaking the layout.  

---

## 🛠️ Tech Stack  

| Layer | Technology | Version / Features | Focus |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Next.js** | 15.5 (App Router), React 19, TypeScript | Routing, Components, SSR |
| **Styling** | **Tailwind CSS** | v4 | Fast, Responsive UI |
| **Real-Time** | **Socket.IO** | v4 | Live Sync, WebSocket Events |
| **Backend** | **Express.js** | v5 | REST API, Server Logic |
| **Database & Auth** | **Supabase** | Auth, PostgreSQL RPC, Storage | Login, Data, File Storage |
| **Runtime** | **Bun** | — | Build Speed, Fast Server Start |

---
