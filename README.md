# Financial Events Radar

![Financial Events Radar Screenshot](https://storage.googleapis.com/gemini-marc-resources/financial-events-radar-screenshot.png)

A sophisticated, real-time dashboard that displays upcoming and past macroeconomic and corporate earnings announcements. This tool is designed to provide traders, investors, and financial enthusiasts with a clear and interactive view of market-moving events, powered by the Google Gemini API with Google Search grounding for up-to-the-minute data.

**[➡️ View Live Demo](https://your-github-username.github.io/your-repo-name/)** *(Replace with your GitHub Pages link after deployment)*

---

## ✨ Features

- **Dual-Column Layout**: Cleanly separates Macroeconomic Events and Corporate Earnings for easy side-by-side comparison.
- **Real-Time Data**: Leverages the Gemini API with Google Search grounding to fetch the latest event data.
- **Live Time & Countdowns**: A header clock and per-event countdowns are displayed in the user's local timezone, updating every second.
- **Impact Filtering (Macro)**: Color-coded events (High, Medium, Low impact) with interactive filters to show only what matters to you.
- **Collapsible Day Sections**: Upcoming events are grouped by day, with accordion-style controls to expand and collapse each day's schedule, reducing clutter.
- **Detailed Event Cards**:
    - **Macro**: Displays Actual, Forecast, and Previous figures in a clean layout. Past "Actual" figures are color-coded (green/red) based on performance vs. forecast.
    - **Corporate**: Shows announcement periods (Pre-market/Post-market), information type, and analyst predictions.
- **Interactive Tooltips**: Hover over any event title to see a detailed description in a floating tooltip.
- **Past Events Review**: A collapsible section shows the last 3 days of events for historical context and analysis.
- **Sticky Header**: The main header and column titles remain visible on scroll for persistent context.
- **Auto-Hiding Subscription Bar**: A sleek, floating footer bar for newsletter subscriptions that expands on hover or when scrolling to the bottom of the page.
- **Responsive Design**: A clean and modern UI that is fully responsive and works seamlessly on desktop and mobile devices.
- **Accessible UI**: ARIA attributes are used to ensure accessibility for screen readers and keyboard navigation.

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, TypeScript
- **API**: Google Gemini API (`@google/genai`) with Google Search grounding
- **Fonts**: Google Fonts (Inter)

## 🚀 Setup and Running

This project is designed to run in a web environment where the Gemini API key is securely managed as an environment variable.

1.  **API Key**: The application expects the Google Gemini API key to be available as `process.env.API_KEY`. It must be configured in the deployment environment.
2.  **Run**: Simply open the `index.html` file in a browser that supports ES modules. The development environment will handle the TypeScript compilation automatically.

---

## 🌐 Deploying to GitHub Pages

You can easily deploy this project as a live demo using GitHub Pages.

### Step 1: Push to GitHub

1.  Create a new repository on [GitHub](https://github.com/new).
2.  Follow the instructions to push your local project files (`index.html`, `index.css`, `index.tsx`, `README.md`, etc.) to the new repository.

### Step 2: Configure GitHub Pages

1.  In your repository, go to **Settings** > **Pages**.
2.  Under "Build and deployment", select the **Source** as **Deploy from a branch**.
3.  Choose the `main` (or `master`) branch and the `/ (root)` folder, then click **Save**.
4.  Your site will be deployed within a few minutes at the URL shown on the Pages settings screen (e.g., `https://your-username.github.io/your-repo-name/`).

### ⚠️ IMPORTANT: API Key Security on GitHub Pages

GitHub Pages hosts **static client-side files**. There is no secure way to provide an API key to client-side JavaScript without exposing it publicly in the code.

**Never hardcode your API key directly into the `index.tsx` file.** If you do, it will be visible to anyone who inspects your site's source code, and your key could be stolen and abused.

For a public demo, the recommended approach is to create a "proxy" server that hides your key. Here is the general idea:

1.  **Create a Serverless Function**: Use a free service like Netlify Functions, Vercel Edge Functions, or Google Cloud Functions.
2.  **Store the Key Securely**: In your serverless function's environment variables (which are secure), store your `API_KEY`.
3.  **Create a Proxy Endpoint**: The function will receive requests from your GitHub Pages site, add the secure API key, and then forward the request to the Gemini API. It then returns the Gemini API's response back to your site.
4.  **Update `index.tsx`**: Modify the `fetchFinancialData` function to call your new serverless function endpoint instead of the Gemini API directly.

This setup ensures your API key remains secret on the server while your static frontend on GitHub Pages can still fetch the data it needs.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
