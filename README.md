# Friend Wave - Social Media App

Friend Wave is a social media app designed to connect friends and share moments. This README provides basic information for running it in a development environment.

## Technology Stack

Friend Wave is built using the following technologies:

[![Stack Used](https://skillicons.dev/icons?i=mongodb,js,typescript,nodejs,express&theme=dark)](https://skillicons.dev)



**Note: Friend Wave is currently in development.**

## Getting Started

### Prerequisites

- Node.js 22 or newer
- npm

### Installation

1. Clone the repository:
git clone [https://github.com/LawrenceY-B/friend-wave.git](https://github.com/LawrenceY-B/Friendwave.git)

2. Navigate to the project directory:
cd friendwave
   
3. Install dependencies:
npm install

4. Create your environment file and fill in the values (Auth0 setup: [docs/AUTH.md](docs/AUTH.md)):
cp .env.example .env

5. Start the development server (reloads on changes):
npm run dev


The API runs at `http://localhost:4000` (`GET /health` to check). Endpoints, conventions and how to use
it from Next.js: **[docs/API.md](docs/API.md)**. Machine-readable spec: `GET /api/openapi.json`.

### Tests

```
npm test        # 36 tests: every endpoint, auth, permissions, realtime. No network or real DB needed
```

### Trying it as a real user

```
TOKEN=$(npm run -s token -- alice@test.com 'Str0ng-pass!' --signup)
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/users/me
```

See [docs/AUTH.md](docs/AUTH.md) for the one-time Auth0 setup this needs.

### Production build

```
npm run build   # compiles TypeScript to ./build
npm start       # runs ./build/server.js
```

### Maintenance scripts (`scripts/`)

All database scripts do a dry run unless given `--apply`, and write a backup to `backups/` first.

| Script | Purpose |
|---|---|
| `get-token.mjs` (`npm run token`) | Auth0 access token for a test user |
| `link-accounts.mjs` | link two Auth0 logins of one person |
| `merge-users.mjs` | merge Friendwave accounts after linking |
| `cleanup-data.mjs` | repair broken references, misplaced messages, old image links |
| `delete-users.mjs` | delete accounts and everything of theirs: `--keep a,b` (everyone else) or `--delete a,b` |
| `migrate-v2.mjs` | one-off migration to the v2 data model (done 2026-10-09) |

See [docs/CHANGES.md](docs/CHANGES.md) for the October 2026 upgrade notes and lessons, and deployment notes (Render).

## Work Done

- Feature 1: Follow and Unfollow ✅
- Feature 2: User Authentication (Auth0 access tokens) ✅
- Feature 3: Add Posts ✅
- Feature 4: Comments ✅
- Feature 5: Stories ✅
- Feature 6: Message ✅
- Feature 7: Real-time Messaging ✅
- Feature 8: Feed, pagination, OpenAPI spec, tests ✅


## Contact

- Email: [lawrencekybj@gmail.com]
- GitHub: [LawrenceY-B](https://github.com/LawrenceY-B)

---





