# Fitness Trainer App

A React + Vite fitness trainer application inspired by the reference tracker, with support for importing HTML and PDF fitness plans.

## Features

- Dashboard with calories, protein, cardio, and target loss summary
- Weekly progress tracking with per-day completion
- Plan, Meals, Tips, and Import views
- HTML file import
- PDF file import using `pdfjs-dist`
- Pasted HTML parsing
- Local storage persistence for the active plan and progress state
- Included sample HTML plan for import testing

## Getting Started

```bash
npm install
npm run dev
```

Open the local Vite URL shown in your terminal.

## Build for Production

```bash
npm run build
npm run preview
```

## Import Notes

- Best results come from text-based HTML and text-based PDFs.
- Scanned PDFs without embedded text may need OCR or a backend parser later.
- The current parser normalizes extracted text into a weekly structure using heuristics.

## Test Import File

Use the included file below from the app's import page:

```text
sample-plans/sample-fitness-plan.html
```

## Project Structure

```text
fitness-trainer-app/
  index.html
  package.json
  vite.config.js
  src/
    App.jsx
    main.jsx
    styles.css
  sample-plans/
    sample-fitness-plan.html
```
