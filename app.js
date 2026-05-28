// app.js
import { auth, db } from "./firebase-config.js";
import {
    onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
    query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion,
    arrayRemove, limit, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── State ──────────────────────────────────────────────────────
let currentUser   = null;
let currentChatId = null;
let unsubMessages = null;
let unsubRequests = null;
let unsubFriends  = null;

// ── Auth guard ─────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
    if (!user) { window.location.href = "index.html"; return; }
    currentUser = user;
    await loadMe();
    bindListeners();
    listenFriends();
    listenRequests();
});

// ── Load current user profile ──────────────────────────────────
async function loadMe() {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    const data = snap.data() || {};
    document.getElementById("myName").textContent    = data.displayName || currentUser.displayName || "You";
    document.getElementById("myUsername").textContent = "@" + (data.username || "");
    setAvatarEl(document.getElementById("myAvatar"), data.displayName || currentUser.displayName, data.photoURL);
}

// ── Avatar helper ──────────────────────────────────────────────
function setAvatarEl(el, name, photoURL) {
    if (photoURL) {
        el.innerHTML = `<img src="${photoURL}" alt="${name}" onerror="this.remove()"/>`;
    } else {
        el.textContent = (name || "?")[0].toUpperCase();
    }
}

function createAvatar(name, photoURL, extraClass = "") {
    const div = document.createElement("div");
    div.className = "avatar" + (extraClass ? " " + extraClass : "");
    setAvatarEl(div, name, photoURL);
    return div;
}

// ── Bind static event listeners ───────────────────────────────
function bindListeners() {
    document.getElementById("signOutBtn").addEventListener("click", () => signOut(auth));

    // Search
    let searchTimer;
    document.getElementById("searchInput").addEventListener("input", e => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => searchUsers(e.target.value.trim()), 350);
    });

    // Send message
    document.getElementById("sendBtn").addEventListener("click", sendMessage);
    document.getElementById("msgInput").addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    // Auto-resize textarea
    document.getElementById("msgInput").addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });

    // Back button (mobile)
    document.getElementById("backBtn").addEventListener("click", () => {
        document.getElementById("chatView").hidden = true;
        document.getElementById("emptyState").hidden = false;
        document.querySelectorAll(".friend-item").forEach(i => i.classList.remove("active"));
        currentChatId = null;
        if (unsubMessages) { unsubMessages(); unsubMessages = null; }
    });

    // Sidebar toggle (mobile)
    document.getElementById("sidebarToggle").addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("open");
    });
}

// ── User search ────────────────────────────────────────────────
async function searchUsers(term) {
    const container = document.getElementById("searchResults");
    container.innerHTML = "";
    if (!term || term.length < 2) return;

    const q = query(
        collection(db, "users"),
        where("username", ">=", term.toLowerCase()),
        where("username", "<=", term.toLowerCase() + "\uf8ff"),
        limit(6)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
        container.innerHTML = `<div class="list-empty">No users found</div>`;
        return;
    }

    for (const d of snap.docs) {
        const data = d.data();
        if (data.uid === currentUser.uid) continue;
        container.appendChild(await buildSearchItem(data));
    }
}

async function buildSearchItem(userData) {
    // Check relationship
    const mySnap  = await getDoc(doc(db, "users", currentUser.uid));
    const myData  = mySnap.data() || {};
    const friends = myData.friends || [];

    // Check pending request
    const reqId  = [currentUser.uid, userData.uid].sort().join("_");
    const reqSnap = await getDoc(doc(db, "friendRequests", reqId));

    let btnLabel = "Add";
    let btnClass = "add";
    let disabled = false;

    if (friends.includes(userData.uid)) {
        btnLabel = "Friends"; btnClass = "pending"; disabled = true;
    } else if (reqSnap.exists()) {
        const req = reqSnap.data();
        if (req.from === currentUser.uid) {
            btnLabel = "Pending"; btnClass = "pending"; disabled = true;
        } else {
            btnLabel = "Accept"; btnClass = "accept";
        }
    }

    const item = document.createElement("div");
    item.className = "friend-item";
    item.appendChild(createAvatar(userData.displayName, userData.photoURL));

    const info = document.createElement("div");
    info.className = "info";
    info.innerHTML = `<span class="name">${esc(userData.displayName)}</span>
                    <span class="sub">@${esc(userData.username)}</span>`;
    item.appendChild(info);

    const btn = document.createElement("button");
    btn.className = `act-btn ${btnClass}`;
    btn.textContent = btnLabel;
    btn.disabled = disabled;
    btn.addEventListener("click", async e => {
        e.stopPropagation();
        if (btnClass === "accept") {
            await acceptRequest(userData.uid);
        } else if (!disabled) {
            await sendFriendRequest(userData.uid);
            btn.textContent = "Pending";
            btn.className   = "act-btn pending";
            btn.disabled    = true;
        }
    });
    item.appendChild(btn);
    return item;
}

// ── Friend requests ────────────────────────────────────────────
async function sendFriendRequest(toUid) {
    const reqId = [currentUser.uid, toUid].sort().join("_");
    await setDoc(doc(db, "friendRequests", reqId), {
        from:      currentUser.uid,
        to:        toUid,
        createdAt: serverTimestamp()
    });
}

async function acceptRequest(fromUid) {
    const reqId = [currentUser.uid, fromUid].sort().join("_");
    // Add each other as friends
    await updateDoc(doc(db, "users", currentUser.uid), { friends: arrayUnion(fromUid) });
    await updateDoc(doc(db, "users", fromUid),         { friends: arrayUnion(currentUser.uid) });
    // Remove the request
    await deleteDoc(doc(db, "friendRequests", reqId));
    // Clear search
    document.getElementById("searchInput").value = "";
    document.getElementById("searchResults").innerHTML = "";
}

async function declineRequest(fromUid) {
    const reqId = [currentUser.uid, fromUid].sort().join("_");
    await deleteDoc(doc(db, "friendRequests", reqId));
}

// ── Real-time: incoming requests ──────────────────────────────
function listenRequests() {
    const q = query(collection(db, "friendRequests"), where("to", "==", currentUser.uid));
    if (unsubRequests) unsubRequests();
    unsubRequests = onSnapshot(q, async snap => {
        const list  = document.getElementById("requestsList");
        const badge = document.getElementById("reqBadge");
        list.innerHTML = "";

        if (snap.empty) {
            badge.hidden = true;
            list.innerHTML = `<div class="list-empty">No pending requests</div>`;
            return;
        }

        badge.hidden = false;
        badge.textContent = snap.size;

        for (const d of snap.docs) {
            const req      = d.data();
            const userSnap = await getDoc(doc(db, "users", req.from));
            const userData = userSnap.data() || {};

            const item = document.createElement("div");
            item.className = "friend-item";
            item.appendChild(createAvatar(userData.displayName, userData.photoURL));

            const info = document.createElement("div");
            info.className = "info";
            info.innerHTML = `<span class="name">${esc(userData.displayName)}</span>
                        <span class="sub">wants to add you</span>`;
            item.appendChild(info);

            const actions = document.createElement("div");
            actions.className = "actions";

            const acceptBtn = document.createElement("button");
            acceptBtn.className = "act-btn accept";
            acceptBtn.textContent = "✓";
            acceptBtn.addEventListener("click", () => acceptRequest(req.from));

            const declineBtn = document.createElement("button");
            declineBtn.className = "act-btn decline";
            declineBtn.textContent = "✕";
            declineBtn.addEventListener("click", () => declineRequest(req.from));

            actions.appendChild(acceptBtn);
            actions.appendChild(declineBtn);
            item.appendChild(actions);
            list.appendChild(item);
        }
    });
}

// ── Real-time: friends list ────────────────────────────────────
function listenFriends() {
    if (unsubFriends) unsubFriends();
    unsubFriends = onSnapshot(doc(db, "users", currentUser.uid), async snap => {
        const data    = snap.data() || {};
        const friends = data.friends || [];
        const list    = document.getElementById("friendsList");
        list.innerHTML = "";

        if (!friends.length) {
            list.innerHTML = `<div class="list-empty">Add friends to start chatting</div>`;
            return;
        }

        for (const uid of friends) {
            const fSnap = await getDoc(doc(db, "users", uid));
            if (!fSnap.exists()) continue;
            const fData = fSnap.data();

            const chatId = [currentUser.uid, uid].sort().join("_");

            // Get last message
            const msgQ = query(
                collection(db, "chats", chatId, "messages"),
                orderBy("createdAt", "desc"),
                limit(1)
            );
            const msgSnap = await getDocs(msgQ);
            const lastMsg = msgSnap.empty ? "Say hi! 👋" : msgSnap.docs[0].data().text;

            const item = document.createElement("div");
            item.className = "friend-item";
            item.dataset.uid    = uid;
            item.dataset.chatId = chatId;

            if (chatId === currentChatId) item.classList.add("active");

            item.appendChild(createAvatar(fData.displayName, fData.photoURL));

            const info = document.createElement("div");
            info.className = "info";
            info.innerHTML = `<span class="name">${esc(fData.displayName)}</span>
                        <span class="sub">${esc(lastMsg.slice(0, 40))}${lastMsg.length > 40 ? "…" : ""}</span>`;
            item.appendChild(info);

            item.addEventListener("click", () => openChat(uid, fData, chatId, item));
            list.appendChild(item);
        }
    });
}

// ── Open chat ──────────────────────────────────────────────────
function openChat(uid, fData, chatId, listItem) {
    currentChatId = chatId;

    // Highlight
    document.querySelectorAll(".friend-item").forEach(i => i.classList.remove("active"));
    listItem.classList.add("active");

    // Header
    const chatAvatar = document.getElementById("chatAvatar");
    setAvatarEl(chatAvatar, fData.displayName, fData.photoURL);
    document.getElementById("chatName").textContent   = fData.displayName;
    document.getElementById("chatStatus").textContent = "online";

    // Show chat view
    document.getElementById("emptyState").hidden = true;
    document.getElementById("chatView").hidden   = false;

    // Mobile: close sidebar
    document.getElementById("sidebar").classList.remove("open");

    // Unsubscribe previous listener
    if (unsubMessages) { unsubMessages(); unsubMessages = null; }

    // Ensure chat doc exists
    setDoc(doc(db, "chats", chatId), { members: [currentUser.uid, uid] }, { merge: true });

    // Listen to messages
    const q = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("createdAt", "asc")
    );
    unsubMessages = onSnapshot(q, snap => {
        renderMessages(snap, fData);
    });
}

// ── Render messages ────────────────────────────────────────────
function renderMessages(snap, fData) {
    const container = document.getElementById("messages");
    container.innerHTML = "";
    let lastDate = null;

    snap.forEach(d => {
        const msg   = d.data();
        const mine  = msg.uid === currentUser.uid;
        const ts    = msg.createdAt?.toDate?.() || new Date();
        const dateStr = ts.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        const timeStr = ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

        if (dateStr !== lastDate) {
            const sep = document.createElement("div");
            sep.className = "date-sep";
            sep.textContent = dateStr;
            container.appendChild(sep);
            lastDate = dateStr;
        }

        const row = document.createElement("div");
        row.className = `msg-row ${mine ? "mine" : "theirs"}`;

        if (!mine) {
            row.appendChild(createAvatar(fData.displayName, fData.photoURL, "msg-avatar"));
        }

        const col = document.createElement("div");
        col.style.display = "flex";
        col.style.flexDirection = "column";
        col.style.alignItems = mine ? "flex-end" : "flex-start";
        col.style.gap = "2px";

        const bubble = document.createElement("div");
        bubble.className = "msg-bubble";
        bubble.textContent = msg.text;

        const meta = document.createElement("div");
        meta.className = "msg-meta";
        meta.textContent = timeStr;

        col.appendChild(bubble);
        col.appendChild(meta);
        row.appendChild(col);
        container.appendChild(row);
    });

    container.scrollTop = container.scrollHeight;
}

// ── Send message ───────────────────────────────────────────────
async function sendMessage() {
    if (!currentChatId) return;
    const input = document.getElementById("msgInput");
    const text  = input.value.trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";

    await addDoc(collection(db, "chats", currentChatId, "messages"), {
        text,
        uid:       currentUser.uid,
        createdAt: serverTimestamp()
    });

    // Update chat metadata
    await setDoc(doc(db, "chats", currentChatId), {
        lastMessage: text,
        lastAt:      serverTimestamp()
    }, { merge: true });
}

// ── Escape helper ──────────────────────────────────────────────
function esc(str = "") {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}