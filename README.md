# SHADOW PROTOCOL: Echoes of the Last Light

A third-person 3D sci-fi action-adventure game set in an abandoned 2099 metropolis where a rogue AI named **SHADOW** has seized the city's energy network. Play as the last surviving Guardian, switch between **Reality** and **Shadow** dimensions with **Echo Shift**, uncover three Energy Cores, breach the Central Reactor, and defeat **THE SHADOW GUARDIAN**.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in any modern browser.

Production build:

```bash
npm run build
```

Run pure-logic unit tests:

```bash
npx --yes tsx --test src/game/rules.test.ts
```

## Controls

| Key / Input | Action |
|---|---|
| `W` `A` `S` `D` | Move Guardian |
| `Mouse` / `Arrow Left/Right` | Aim & Rotate Camera |
| `Left Click` | Fire Plasma Rifle |
| `Space` | Jump |
| `Shift` | Evade Dash |
| `Q` | **Echo Shift** (Toggle Reality / Shadow Mode) |
| `E` | Interact / Activate Central Reactor |
| `R` | Reload Plasma Rifle |
| `M` | Mute / Unmute Audio |
| `Esc` / `P` | Pause / Resume |

## Core Features

1. **Echo Shift (Dual-Dimension Gameplay)**:
   - **Reality Mode**: Neon midnight-blue cityscape with physical phase barriers, hidden energy vaults, and heavily armored Sentinels.
   - **Shadow Mode (`Q`)**: Shifts lighting, fog, and world geometry to purple/magenta—phasing out Reality barriers, solidifying luminous Echo Bridges, revealing hidden Energy Cores, and exposing enemy & boss weak points for critical hits.
2. **Three Connected Zones**:
   - **Zone 1 — The Fallen City**: Movement, shooting, Shadow Scouts & Hunters, and Core 1/3.
   - **Zone 2 — The Shadow District**: Phase barrier puzzle, Echo Skywalk platforms, Shadow Vault (Core 2/3 & 3/3), and Shadow Sentinel.
   - **Zone 3 — The Central Reactor**: Unlocks at 3/3 Cores; features Reactor Console activation and the 3-phase **Shadow Guardian** boss battle.
3. **Enemy AI & Boss Encounter**:
   - Three distinct robotic archetypes (**Shadow Scout**, **Shadow Hunter**, **Shadow Sentinel**) with windup attack telegraphs and state-machine behaviors.
   - **The Shadow Guardian** boss with Phase 1 plasma spreads, Phase 2 protective shield (requiring Shadow Mode `Q` to expose weak point), and Phase 3 overdrive + arena floor hazards.
4. **100% Procedural 3D & Web Audio**:
   - Multi-part composite Three.js geometry, `CanvasTexture` PBR materials, `RoomEnvironment` reflections, object-pooled `InstancedMesh` particles & bolts, and real-time Web Audio API sound synthesis.
