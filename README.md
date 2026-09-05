# Context Bridge 🌉

> **Universal Context Layer for AI Interfaces**

Context Bridge is a browser extension designed to provide a shared context layer for AI-powered interfaces.

It acts as a bridge between web-based AI applications and the information available in your browser, making it easier for AI interfaces to work with relevant page content and context.

---

## ✨ Features

* 🌐 **Browser-based context access** — Work with information from the current webpage.
* 🤖 **AI-ready context layer** — Provides a structured layer between web content and AI interfaces.
* 🧩 **Chrome Extension** — Runs directly inside the browser.
* 📄 **Content extraction** — Collects and processes relevant webpage content.
* 🔌 **Modular architecture** — Separates AI, background, content, popup, types, and utility functionality.
* ⚡ **TypeScript** — Strongly typed and maintainable codebase.
* 📦 **Webpack bundling** — Optimized production builds for the extension.

---

## 🏗️ Architecture

Context Bridge is organized into several major components:

```text
Context_Bridge/
│
├── src/
│   ├── ai/              # AI-related functionality
│   ├── background/      # Chrome extension background logic
│   ├── content/         # Webpage/content interaction
│   ├── popup/           # Extension popup UI
│   ├── types/           # Shared TypeScript types
│   ├── utils/           # Utility functions
│   └── manifest.json    # Chrome extension configuration
│
├── dist/                # Built extension files
├── icons/               # Extension icons
│
├── package.json         # Project configuration
├── package-lock.json    # Dependency lock file
├── tsconfig.json        # TypeScript configuration
└── webpack.config.js    # Webpack configuration
```

The repository currently separates browser functionality into `background`, `content`, and `popup` components, with dedicated modules for AI functionality and shared types/utilities.

---

## 🛠️ Tech Stack

| Technology                  | Purpose                                |
| --------------------------- | -------------------------------------- |
| **TypeScript**              | Application development                |
| **Chrome Extensions API**   | Browser integration                    |
| **Webpack 5**               | Bundling                               |
| **ts-loader**               | TypeScript/Webpack integration         |
| **JavaScript / HTML / CSS** | Extension UI and browser functionality |

The project uses TypeScript 5.x, Webpack 5, `ts-loader`, and Chrome type definitions.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

* [Node.js](https://nodejs.org/)
* npm
* Google Chrome

---

### 1. Clone the repository

```bash
git clone https://github.com/abhi0922/Context_Bridge.git
cd Context_Bridge
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Build the extension

For a production build:

```bash
npm run build
```

For development with automatic rebuilding:

```bash
npm run dev
```

The available npm scripts are defined in `package.json`: `build` runs Webpack in production mode, while `dev` runs Webpack in development/watch mode.

---

## 🧩 Load the Extension in Chrome

After building the project:

1. Open Google Chrome.
2. Navigate to:

```text
chrome://extensions/
```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the generated extension directory.

Once loaded, the Context Bridge extension should appear in your Chrome extensions list.

---

## 💡 How It Works

At a high level, Context Bridge provides a communication layer between the browser and AI-related functionality.

```text
                ┌─────────────────────┐
                │     Web Page        │
                │                     │
                │  Text / DOM / Data  │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Content Script    │
                │                     │
                │ Extract / Process   │
                │      Context        │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │ Background Layer    │
                │                     │
                │ Extension Logic /  │
                │ Message Handling    │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │    AI Layer         │
                │                     │
                │ Context Processing  │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   AI Interface      │
                └─────────────────────┘
```

This modular design allows browser content, extension logic, and AI-related functionality to remain separated and easier to maintain.

---

## 📁 Project Modules

### `src/ai`

Contains functionality related to interaction with AI systems and AI-oriented context processing.

### `src/background`

Contains background/service-worker functionality for the Chrome extension.

Typical responsibilities include:

* Extension lifecycle handling
* Message passing
* Communication between extension components
* Background processing

### `src/content`

Handles interaction with webpages.

Typical responsibilities include:

* Accessing webpage content
* Extracting relevant information
* Communicating webpage context to the extension

### `src/popup`

Contains the user-facing extension popup.

This provides the browser UI through which users can interact with Context Bridge.

### `src/types`

Contains shared TypeScript type definitions used across different modules.

### `src/utils`

Contains reusable helper and utility functions.

---

## 🔧 Development

Start Webpack in watch mode:

```bash
npm run dev
```

This watches the source files and rebuilds the extension when changes are detected.

For a production build:

```bash
npm run build
```

---

## 🧪 Testing

Before opening a pull request, make sure the project builds successfully:

```bash
npm install
npm run build
```

Then reload the unpacked extension from:

```text
chrome://extensions/
```

and verify the extension functionality in Chrome.

---

## 🔐 Privacy & Security

Context Bridge operates as a browser extension and may interact with webpage content depending on the functionality being used.

When extending the project, take care to:

* Request only the browser permissions that are required.
* Avoid collecting unnecessary webpage data.
* Never expose sensitive webpage information unintentionally.
* Keep API keys and credentials out of the source code.
* Validate messages exchanged between extension components.
* Review Chrome extension permissions before publishing.

---

## 🗺️ Roadmap

Potential future improvements include:

* [ ] Support for additional AI interfaces
* [ ] Improved webpage context extraction
* [ ] Context selection and filtering
* [ ] Persistent context management
* [ ] Better context visualization
* [ ] Configurable AI providers
* [ ] Improved extension settings
* [ ] Automated tests
* [ ] Chrome Web Store distribution
* [ ] Firefox/Chromium compatibility improvements

---

## 🤝 Contributing

Contributions are welcome!

### Development workflow

1. Fork the repository.
2. Create a feature branch:

```bash
git checkout -b feature/my-feature
```

3. Make your changes.
4. Build the project:

```bash
npm run build
```

5. Commit your changes:

```bash
git commit -m "Add my feature"
```

6. Push the branch:

```bash
git push origin feature/my-feature
```

7. Open a Pull Request.

---

## 📜 License

Please check the repository for the current license before redistributing or using the project commercially.

---

## 🔗 Repository

**GitHub:**
https://github.com/abhi0922/Context_Bridge

---

## ⭐ Support

If you find Context Bridge useful, consider starring the repository and contributing improvements.

**Context Bridge — connecting browser context with AI. 🌉🤖**
