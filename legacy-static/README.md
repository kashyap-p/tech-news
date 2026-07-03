# Tech News

Static tech-news demo site built with plain HTML, CSS and JavaScript.

## Project Overview

- **Purpose:** Small static site to display tech news snippets.
- **Contents:** A single-page site (no build step) using `index.html`, `css/style.css`, and `js/app.js`.

## Quick Start

Prerequisites: a modern web browser. Optional: Python or Node.js for a local static server.

To run locally (choose one):

- Open `index.html` directly in your browser (double-click the file).
- Run a simple HTTP server from the project root:
  - Python 3:

    ```bash
    python -m http.server 8000
    ```

  - Node (http-server):

    ```bash
    npx http-server . -p 8080
    ```

Then open `http://localhost:8000` (or `:8080`).

## Project Structure

- `index.html` — main page
- `css/style.css` — site styles
- `js/app.js` — frontend behaviour

## Development Instructions & Steps

1. Edit layout and markup in `index.html`.
2. Update styles in `css/style.css`.
3. Implement or modify interactions in `js/app.js`.
4. Use a local server (recommended) to avoid CORS issues when fetching data.
5. Refresh the browser to see changes; use the devtools console for debugging.

Suggested development workflow:

- Create a branch per feature (if using git).
- Make incremental changes and test in the browser.
- Commit small changes with clear messages.

## Future Features (Roadmap)

- Fetch live news from an API (e.g., NewsAPI) with graceful error handling.
- Add pagination or infinite scroll for long lists.
- Implement search and category filters.
- Add offline support with a Service Worker and caching.
- Improve accessibility (ARIA, keyboard navigation, semantic HTML).
- Add unit / integration tests for JS logic.
- Make the site responsive and add design polish (animations, transitions).
- Add a build step (webpack/Vite) for production optimization.

## Contributing

Open an issue or create a pull request with a clear description of your change.
