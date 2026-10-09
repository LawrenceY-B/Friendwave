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


Access Friend Wave at `http://localhost:3000`.

### Testing as a user

```
TOKEN=$(npm run -s token -- alice@test.com 'Str0ng-pass!' --signup)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users/getUser
```

See [docs/AUTH.md](docs/AUTH.md) for the one-time Auth0 setup this needs.

### Production build

```
npm run build   # compiles TypeScript to ./build
npm start       # runs ./build/app.js
```

See [docs/CHANGES.md](docs/CHANGES.md) for the October 2026 upgrade notes, client-facing API changes and deployment notes (Render).

## Work Done

- Feature 1: Follow and Unfollow ✅
- Feature 2: User Authentication (Auth0 access tokens) ✅
- Feature 3: Add Posts ✅
- Feature 4: Comments ✅
- Feature 5: Stories ✅
- Feature 6: Message ✅
- Feature 7: Real-time Messaging (working on it 😮‍💨)


## Contact

- Email: [lawrencekybj@gmail.com]
- GitHub: [LawrenceY-B](https://github.com/LawrenceY-B)

---





