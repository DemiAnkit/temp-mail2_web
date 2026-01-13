# Temp Mail Web

A modern, temporary email service built with **Next.js** and **Cloudflare Workers**. This project provides a disposable email address for users to receive emails, protecting their primary inbox from spam.

## 🚀 Project Structure

This is a monorepo-style project containing:

- **`frontend/`**: The web application built with [Next.js](https://nextjs.org/).
- **`worker/`**: The backend API powered by [Cloudflare Workers](https://workers.cloudflare.com/), handling email processing and storage.

---

## 🛠 Technologies & Tools

### Frontend (`/frontend`)

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Library**: [React 19](https://react.dev/)
- **Utilities**: `date-fns` (Date formatting), `dompurify` (HTML Sanitization)
- **Linting**: ESLint

### Backend / Worker (`/worker`)

- **Platform**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Language**: TypeScript
- **Database**: [Supabase](https://supabase.com/) (using `@supabase/supabase-js`)
- **Email Parsing**: [`postal-mime`](https://github.com/postalsys/postal-mime) (for parsing raw email data)
- **Tooling**: [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (CLI for Cloudflare Workers)

---

## ⚙️ How It Works

1.  **Email Reception**: Incoming emails are routed to the Cloudflare Worker (via Cloudflare Email Routing).
2.  **Processing**: The Worker uses `postal-mime` to parse the raw email content.
3.  **Storage**: Parsed emails are stored in a Supabase database.
4.  **Frontend Access**: The Next.js frontend calls the Worker API (`/api/mailbox`, `/api/messages/:id`) to create temporary mailboxes and fetch messages.
5.  **Display**: The frontend renders the inbox and email contents, sanitizing HTML for security.

---

## 💻 Getting Started (Local Development)

Follow these steps to run the project locally.

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Wrangler CLI (`npm install -g wrangler`)
- A Supabase project (for database)

### 1. Backend Setup (`worker/`)

Navigate to the worker directory:

```bash
cd worker
```

Install dependencies:

```bash
npm install
```

Configure Environment Variables:
Create a `.dev.vars` file in the `worker/` directory for your local secrets:

```ini
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

Run the worker locally:

```bash
npm run dev
# Starts the API at http://localhost:8787
```

### 2. Frontend Setup (`frontend/`)

Open a new terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Configure Environment Variables:
Create a `.env.local` file in the `frontend/` directory:

```ini
NEXT_PUBLIC_API_URL=http://localhost:8787
```

Run the frontend development server:

```bash
npm run dev
# Starts the UI at http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌍 Production & Deployment

### Backend (Cloudflare Workers)

1.  **Login to Cloudflare**:

    ```bash
    npx wrangler login
    ```

2.  **Configure Secrets**:
    For production, it is safer to use Wrangler secrets than `wrangler.toml` vars.

    ```bash
    npx wrangler secret put SUPABASE_URL
    npx wrangler secret put SUPABASE_SERVICE_KEY
    ```

3.  **Deploy**:
    ```bash
    npm run deploy
    ```
    This will publish your worker to Cloudflare. Note the deployed URL (e.g., `https://tempmail-api.your-user.workers.dev`).

### Frontend (Netlify / Vercel)

1.  **Build**:
    The project is ready for deployment.

    ```bash
    npm run build
    ```

2.  **Deploy to Netlify/Vercel**:
    - Connect your repository.
    - Set the **Build Command** to `npm run build` (or `next build`).
    - Set the **Publish Directory** to `.next` (or keep default for Next.js).
    - **CRITICAL**: Add the Environment Variable in your deployment dashboard:
      - `NEXT_PUBLIC_API_URL`: Your deployed Worker URL (e.g., `https://tempmail-api.your-user.workers.dev`).

---

## 📝 Essential Files

- **`frontend/src/lib/api.ts`**: Handles API requests to the worker.
- **`worker/src/index.ts`**: Main entry point for the API logic.
- **`worker/wrangler.toml`**: Cloudflare Worker configuration.
- **`frontend/next.config.ts`**: Next.js configuration.
