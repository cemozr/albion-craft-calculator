# Albion Craft Calculator

A desktop application for calculating crafting profitability in **Albion Online**. It fetches real-time market prices and computes your expected profit based on your account settings, crafting station, and chosen cities.

![Electron](https://img.shields.io/badge/Electron-41-blue?logo=electron)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

---

## Features

- **Item search** — find any craftable item by name
- **Tier & enchantment selector** — choose from T4–T8 and enchantment levels @0–@3
- **Location selector** — set separate cities for buying ingredients and selling the output
- **Crafting parameters**
  - Premium account toggle (auto-adjusts market tax: 4% / 8.5%)
  - Focus usage toggle
  - Manual return rate override
  - Buy-order vs. instant-buy for ingredients
  - Crafting fee input
  - Output quality selector (Normal → Masterpiece)
  - Sell mode: sell order or sell now (fill buy order)
- **Profit breakdown** — revenue, material cost, crafting fee, net profit, and ROI
- **Compare list** — pin multiple items side-by-side to compare profitability
- **5-minute price cache** — avoids redundant API calls during a session

---

## How It Works

Prices are fetched live from the community-maintained [Albion Online Data Project](https://www.albion-online-data.com/) API.
Recommended to use AODP client for updated prices.
**If some item prices appears like zero it means nobody updated that items price with AODP client for a while.**

---

## Download

Download the latest Windows installer from the [Releases](../../releases) page.

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm 9+

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm start
```

### Build distributable

```bash
npm run dist
```

The installer will be generated in the `release/` folder.

---

## Tech Stack

| Layer    | Technology            |
| -------- | --------------------- |
| Shell    | Electron 41           |
| UI       | React 19 + TypeScript |
| Bundler  | Vite 8                |
| Packager | electron-builder      |

---

## Disclaimer

This project is not affiliated with or endorsed by Sandbox Interactive GmbH. Albion Online is a registered trademark of Sandbox Interactive GmbH.
