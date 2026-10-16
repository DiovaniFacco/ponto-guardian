<div align="center">

# ⏱️ Ponto Guardian

**Your workday, watched over.**

A tiny desktop app that keeps an eye on your working hours, taps you on the shoulder at the right moment, and punches your **Secullum Ponto Web** clock for you.

[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](#)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)](#)
[![Platform](https://img.shields.io/badge/Linux%20%7C%20Windows-555555)](#)

</div>

---

## 💡 The idea

Nobody enjoys doing mental math at 5 p.m. to figure out whether they've already worked their hours. **Ponto Guardian** does it for you.

It sits in your system tray, follows your workday in the background, tells you when it's time to clock in, reminds you when your break is due, and warns you when you're about to work past your load. If you want, it even **registers the punch** on Secullum for you — straight from the widget, no browser needed.

It runs as a single portable binary: **no install, no admin rights, no dependencies.**

## ✨ What it does

- 🖥️ **Lives in the tray** — Linux (`.AppImage`) and Windows (`.exe portable`), starting with your session if you want.
- 🔄 **Follows the journey in real time** — reads your punches and keeps the current state of the day up to date.
- 🔔 **Tells you what's next** — smart notifications for clocking in, breaks, lunch, and the end of the day (see the full table below).
- 👆 **Punches the clock from the widget** — using your device identifier and a saved location, without opening the browser.
- 🗄️ **Keeps everything local** — settings and history live in a local SQLite database. Nothing is sent anywhere except to the Secullum endpoints it needs.
- 🔧 **One-time setup** — a single configuration screen with company data, credentials, load, device id and location.

## 🚀 Quick install

<details open>
<summary><strong>Linux</strong></summary>

### Install

Run in a terminal:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/DiovaniFacco/ponto-guardian/master/install.sh)
```

The script **downloads the latest `.AppImage`**, installs the `ponto` command, and launches the app.

### Open it again later

```bash
ponto
```

<img src="https://github.com/user-attachments/assets/d1bc236e-9855-4923-9621-e5df88a0b703" />

</details>

<details>
<summary><strong>Windows</strong></summary>

### Install

Open PowerShell and paste:

```powershell
powershell -ExecutionPolicy Bypass -NoProfile -Command "iwr https://raw.githubusercontent.com/DiovaniFacco/ponto-guardian/master/install.ps1 -UseB | iex"
```

<img src="https://github.com/user-attachments/assets/d6a0edae-7b62-4188-bbc2-bbf31d857d62" />

The script **downloads the portable `.exe`**, installs it under `%LOCALAPPDATA%\PontoGuardian\`, and opens the app.

### Create a desktop shortcut

```powershell
$Target="$env:LOCALAPPDATA\PontoGuardian\Ponto Guardian.exe"; $Shortcut="$env:USERPROFILE\Desktop\Ponto Guardian.lnk"; $Shell=New-Object -ComObject WScript.Shell; $Link=$Shell.CreateShortcut($Shortcut); $Link.TargetPath=$Target; $Link.Save()
```

The app keeps running in the background, next to the Windows tray:

<img src="https://github.com/user-attachments/assets/c5c5b1ed-01a7-4287-a43a-6ce149017e68" />

</details>

## ⚙️ Configure the clock (once)

<details open>
<summary><strong>How to fill in the settings</strong></summary>

On first launch, click the gear icon on the widget and fill in the fields.

### Basic data

- **Company ID:** `18914`
- **Login:** your payroll number.
- **Password:** your Secullum password.
- **Daily load:** your daily hours, e.g. `6`.

### Punching from the widget

To use the widget's punch button, enable **Bater ponto pelo widget** and fill in the device identifier.

How to find it:

1. Open the time-clock website in your browser.
2. Press `F12` (or right-click → **Inspect**).
3. Go to the **Application** tab.
4. Open **Local Storage**.
5. Copy the full value of the `identificacaoNavegador` key.
6. Paste it into the **Identificador do dispositivo** field in Ponto Guardian.

<img src="https://github.com/user-attachments/assets/bda1c467-42f5-4d0a-a39d-96c65e263414" />
<img src="https://github.com/user-attachments/assets/c63b296e-dad9-436f-9e1d-c2d15e9927ff" />

### Location

1. Click **Buscar localização**.
2. The browser opens — click **capturar localização**.
3. Accept the location permission.
4. Go back to Ponto Guardian.
5. Click **Salvar** in the settings.

<img src="https://github.com/user-attachments/assets/3c227380-16ef-43fe-af5f-dfe25a054932" />

</details>

## 🔔 Notifications

<details>
<summary><strong>When the app pings you</strong></summary>

| Notification | When it fires |
|---|---|
| Time to clock in | At your configured start time, if there are no punches yet |
| New punch | Whenever a new punch is detected |
| Heads-up before the end | A few minutes before you complete your hours |
| Workday complete | When worked time reaches your daily load |
| Lunch time | At your configured lunch time, if there's still only one punch |
| Time to come back | One hour after the real time of the 2nd punch |
| Punch out | Every 15 minutes after the day is complete, with 3+ punches |

</details>

## ⚠️ Important care

<details>
<summary><strong>Before punching from the widget</strong></summary>

The punch button makes a **real record in Secullum**.

Before using it, make sure:

- **Login and password** are correct.
- **Company ID** is set to `18914`.
- **Device identifier** was copied from **your own** browser.
- **Location** was captured and saved.

Do not use someone else's device identifier.

</details>

## 🛠️ For developers

<details>
<summary><strong>Local setup</strong></summary>

### Requirements

- Node.js 20+
- npm

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run electron
```

### Build locally

```bash
npm run dist:linux
npm run dist:win
```

Prefer running `npm run dist:win` on a Windows machine so the native `better-sqlite3` binaries match the target platform.

</details>

<details>
<summary><strong>Publishing a release</strong></summary>

Artifacts are built automatically by GitHub Actions whenever a `v*` tag is pushed:

```bash
git tag v2
git push origin v2
```

The release then contains:

- **Linux:** `.AppImage`
- **Windows:** `.exe portable`

Colleagues can install with just the **Quick install** commands — no Git, no Node.js.

</details>

## 🧱 Under the hood

| Layer | Choice |
| --- | --- |
| Desktop shell | Electron |
| Language | TypeScript |
| Local storage | SQLite (`better-sqlite3`) |
| Integration | Secullum Ponto Web |
| Packaging | electron-builder (`AppImage` / portable `.exe`) |

## 👤 Author

**Diovani Facco** — [LinkedIn](https://www.linkedin.com/in/diovani-facco-3a247b11a/) · [diovanifacco@gmail.com](mailto:diovanifacco@gmail.com)
