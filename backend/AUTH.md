# Velo API — Firebase Authentication (GitHub only)

Auth is **Firebase Authentication** with **GitHub** as the only sign-in provider. The React app signs in via GitHub; the backend verifies the Firebase ID token. The frontend also receives a **GitHub OAuth access token** (with `repo` scope) for future use to fetch the user’s repositories.

## Flow

1. **Frontend:** User clicks “Continue with GitHub” → Firebase `signInWithPopup` with `GithubAuthProvider` (scope: `repo`).
2. **Frontend:** Stores Firebase user + GitHub access token (from `credential.accessToken`). Token is kept in context and sessionStorage for the session.
3. **Frontend:** Sends Firebase ID token on API requests: `Authorization: Bearer <firebase_id_token>`.
4. **Backend:** Verifies the Firebase token and sets `request.current_user`.
5. **Future:** Frontend can pass `githubAccessToken` (e.g. in a header or body) to backend or use it client-side to call GitHub API (e.g. list user repos).

## Backend endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/me` | Yes | Returns `{ "user": { "id", "email" } }` from the verified token. |
| POST | `/api/analyze` | **Yes** | Same as before; requires valid Firebase ID token. Returns 401 if missing/invalid, 503 if Firebase is not configured. |

## Backend configuration

Set **one** of:

- **`FIREBASE_SERVICE_ACCOUNT_PATH`** — Path to the Firebase service account JSON file (e.g. `./firebase-service-account.json`).
- **`FIREBASE_SERVICE_ACCOUNT_JSON`** — The full JSON content of the service account (e.g. for serverless env vars).

To get the key:

1. Open [Firebase Console](https://console.firebase.google.com) → your project → Project settings → Service accounts.
2. Click “Generate new private key” and save the JSON file (or paste its content into your env).

**Important:** Never commit the JSON file or put it in client-side code. Use it only on the backend.

## Firebase Console setup (GitHub provider)

1. [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Sign-in method**.
2. Enable **GitHub**, add your GitHub OAuth App **Client ID** and **Client Secret** (create one at GitHub → Settings → Developer settings → OAuth Apps). Use the Firebase callback URL shown (e.g. `https://velo-70e3c.firebaseapp.com/__/auth/handler`).
3. Optionally add the `repo` scope in Firebase’s GitHub provider settings so the access token can list/fetch private repos.

## Frontend usage

1. Firebase is initialized with project config; auth is **GitHub only** via `signInWithPopup(auth, new GithubAuthProvider())`.
2. After sign-in, the app has `user`, `getIdToken()`, and `githubAccessToken` (from AuthContext). Use `githubAccessToken` for GitHub API calls (e.g. `GET https://api.github.com/user/repos`).
3. Call the backend with the Firebase ID token:
   ```js
   fetch(`${API_URL}/api/analyze`, {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "Authorization": `Bearer ${idToken}`,
     },
     body: JSON.stringify({ repo_url, team_name, leader_name }),
   });
   ```
5. ID tokens expire after about an hour; use `user.getIdToken(true)` to force a refresh when you get 401.
