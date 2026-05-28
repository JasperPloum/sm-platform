# SparkChat — Setup Guide

A real-time social messaging platform with friend requests, built on Firebase.

---

## 📁 File Structure

```
sparkchat/
├── index.html          ← Login / Sign-up page
├── auth.css            ← Auth page styles
├── auth.js             ← Auth logic (email + Google)
├── app.html            ← Main app (friends + chat)
├── app.css             ← App styles
├── app.js              ← App logic (friends, real-time chat)
├── firebase-config.js  ← 🔑 Your Firebase credentials go here
├── firestore.rules     ← Security rules to deploy
└── README.md           ← This file
```

---

## 🔥 Step 1 — Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project** → give it a name → Continue
3. Disable Google Analytics (optional) → **Create project**

---

## 🔑 Step 2 — Get Your Firebase Config

1. In your project, click the **Web** icon `</>` to add a web app
2. Register the app (any nickname)
   3. Copy the `firebaseConfig` object shown
4. Open `firebase-config.js` and replace the placeholder values

---

## 🔐 Step 3 — Enable Authentication

1. Firebase Console → **Authentication** → **Get started**
2. Enable **Email/Password** provider
3. Enable **Google** provider (add your support email)

---

## 🗄️ Step 4 — Set Up Firestore

1. Firebase Console → **Firestore Database** → **Create database**
2. Start in **test mode** (we'll fix rules next)
3. Choose a region close to your users

### Deploy Security Rules

Either:
- Copy the contents of `firestore.rules` into the Firestore **Rules** tab in the console, OR
- Install Firebase CLI (`npm install -g firebase-tools`) and run:
  ```bash
  firebase login
  firebase init firestore
  firebase deploy --only firestore:rules
  ```

---

## 📊 Step 5 — Create Firestore Indexes

The app needs one composite index. Go to:
**Firestore → Indexes → Composite → Add index**

| Collection | Fields                        | Query scope |
|------------|-------------------------------|-------------|
| `messages` | `createdAt` Ascending         | Collection  |

Or simply run the app — Firebase will show a link in the browser console to auto-create required indexes.

---

## 🌐 Step 6 — Run the App

Because the app uses ES modules (`type="module"`) you need a local server:

```bash
# Option A — Node
npx serve .

# Option B — Python
python3 -m http.server 8080

# Option C — VS Code
Install "Live Server" extension → right-click index.html → Open with Live Server
```

Then open http://localhost:8080

---

## 🚀 Step 7 — Deploy (optional)

### Firebase Hosting (free)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Set public dir to: . (current folder)
# Single-page app: No
firebase deploy
```

---

## 🗂️ Firestore Data Model

```
users/{uid}
  displayName: string
  username:    string   (lowercase, unique-ish)
  email:       string
  photoURL:    string | null
  friends:     string[] (array of uids)
  createdAt:   timestamp

friendRequests/{fromUid_toUid}  (sorted alphabetically)
  from:      string
  to:        string
  createdAt: timestamp

chats/{uid1_uid2}               (sorted alphabetically)
  members:     string[]
  lastMessage: string
  lastAt:      timestamp

chats/{chatId}/messages/{msgId}
  text:      string
  uid:       string
  createdAt: timestamp
```

---

## ✨ Features

- ✅ Email/password sign-up and login
- ✅ Google sign-in
- ✅ Username-based friend search
- ✅ Friend request system (send / accept / decline)
- ✅ Real-time messaging with message history
- ✅ Date separators in chat
- ✅ Auto-scroll to latest message
- ✅ Enter to send (Shift+Enter for new line)
- ✅ Responsive — works on mobile
- ✅ Firestore security rules

---

## 🔧 Customisation Tips

- **Change colours**: Edit the CSS variables at the top of `auth.css` and `app.css`
- **Add emoji reactions**: Add a reaction picker to the message bubble
- **Profile pictures**: Integrate Firebase Storage for custom avatars
- **Online presence**: Write to `users/{uid}.lastSeen` periodically and read it in the sidebar