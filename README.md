# Socially — Mini Social Media App

Socially is a small social networking app built with a vanilla HTML, CSS, and JavaScript frontend, an Express.js API, and MongoDB. Create an account, share posts, comment and like posts, follow other people, and view profiles.

## Features

- Register and sign in with email and password
- JWT-based sessions and hashed passwords
- Create text posts with an optional image URL
- Like and unlike posts
- Comment on posts
- View user profiles and their posts
- Follow and unfollow people
- Discover users and see follow suggestions
- Edit your name, bio, and avatar URL
- Responsive layout for desktop and mobile

## Tech stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js and Express.js
- Database: MongoDB with Mongoose
- Authentication: JSON Web Tokens and bcryptjs

## Requirements

- Node.js and npm
- A MongoDB database, either a local MongoDB server or MongoDB Atlas

## Run locally

1. Clone this repository and open its folder in a terminal.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root. You can copy `.env.example` and replace the values:

   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/socially
   JWT_SECRET=replace-with-a-long-random-secret
   ```

   For MongoDB Atlas, set `MONGODB_URI` to your Atlas connection string. Keep `.env` private and do not commit it.

4. Start the app:

   ```bash
   npm start
   ```

   For development with automatic restarts:

   ```bash
   npm run dev
   ```

5. Visit [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Express server port. Defaults to `3000`. |
| `MONGODB_URI` | Yes for your chosen database | MongoDB connection string. The app defaults to a local `socially` database if omitted. |
| `JWT_SECRET` | Yes | Long, private random value used to sign authentication tokens. |

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Get the signed-in user's profile |
| `GET` | `/api/posts` | List recent posts |
| `POST` | `/api/posts` | Create a post |
| `POST` | `/api/posts/:id/like` | Like or unlike a post |
| `POST` | `/api/posts/:id/comments` | Add a comment |
| `GET` | `/api/users/:username` | View a profile and its posts |
| `POST` | `/api/users/:id/follow` | Follow or unfollow a user |
| `GET` | `/api/users` | List people to discover |
| `PATCH` | `/api/profile` | Update the signed-in user's profile |

## Project structure

```text
social_media/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

## Notes

- Profile avatars and post images are entered as URLs; this project does not upload image files.
- The frontend is served by Express from the `public` directory.
- `.env` and `node_modules/` are excluded by `.gitignore`.
