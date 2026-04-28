// ==========================================
// 1. INITIALISIERUNG
// ==========================================
firebase.initializeApp(CONFIG.firebase);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

let isAdmin = false; 

// ==========================================
// 2. LINKS VERTEILEN
// ==========================================
function applyLinks() {
    const setLink = (id, url) => {
        const el = document.getElementById(id);
        if(el) {
            if(el.tagName === 'A') el.href = url;
            else el.innerText = url;
        }
    };
    setLink('link-twitch', CONFIG.links.twitch);
    setLink('link-yt', CONFIG.links.youtube);
    setLink('link-tt', CONFIG.links.tiktok);
    setLink('link-insta', CONFIG.links.instagram);
    setLink('link-discord', CONFIG.links.deppenCord);
    setLink('link-server-discord', CONFIG.links.serverDiscord); 
    setLink('text-ip', CONFIG.links.serverIP);
}

// ==========================================
// 3. MASTER-STEUERUNG
// ==========================================
auth.onAuthStateChanged(user => {
    applyLinks(); 
    
    const adminPanel = document.getElementById('admin-panel');
    const loginBtns = document.querySelectorAll('.user-login-btn');
    const path = window.location.pathname;
    
    if (user) {
        // Kugelsicherer Admin-Check
        const uEmail = user.email ? user.email.trim().toLowerCase() : "";
        const aEmail = CONFIG.adminEmail ? CONFIG.adminEmail.trim().toLowerCase() : "";
        isAdmin = (uEmail === aEmail && uEmail !== "");

        db.collection('users').doc(user.uid).onSnapshot(doc => {
            let name = user.email.split('@')[0];
            let bio = "";
            
            if (doc.exists) {
                if (doc.data().displayName) name = doc.data().displayName;
                if (doc.data().bio) bio = doc.data().bio;
            }
            
            loginBtns.forEach(btn => {
                btn.innerHTML = "👤 " + name;
                btn.onclick = () => window.location.href = "profil.html";
            });

            if (path.includes('profil.html')) {
                const nameInput = document.getElementById('prof-name');
                const title = document.getElementById('profile-title');
                const bioInput = document.getElementById('prof-bio');
                
                if(nameInput) nameInput.value = name;
                if(title) title.innerText = name;
                if(bioInput) bioInput.value = bio;
            }
        });

        if(isAdmin && adminPanel) {
            adminPanel.style.display = "block";
        }

        if (path.includes('admin.html')) {
            if (isAdmin) renderAdminMessages();
            else window.location.replace("index.html");
        }

    } else {
        isAdmin = false;
        loginBtns.forEach(btn => {
            btn.innerHTML = "LOGIN";
            btn.onclick = openLoginModal;
        });
        
        if(adminPanel) adminPanel.style.display = "none";

        if (path.includes('profil.html') || path.includes('admin.html')) {
            window.location.replace("index.html");
        }
    }
    
    if(document.getElementById('news-list')) loadNews();
});

// Modal Steuerung
function openLoginModal() { document.getElementById('login-modal').style.display = "flex"; }
function closeLoginModal() { document.getElementById('login-modal').style.display = "none"; }

window.handleAuth = function(action) {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    if(!email || !pass) return alert("Bitte alle Felder ausfüllen!");
    
    if(action === 'register') {
        const checkbox = document.getElementById('legal-check');
        if(checkbox && !checkbox.checked) return alert("Bitte akzeptiere die Datenschutzerklärung!");
        auth.createUserWithEmailAndPassword(email, pass).then(() => location.reload()).catch(e => alert("Fehler: " + e.message));
    } else {
        auth.signInWithEmailAndPassword(email, pass).then(() => closeLoginModal()).catch(e => alert("Login fehlgeschlagen!"));
    }
};

window.logoutUser = function() { auth.signOut().then(() => location.reload()); };

// ==========================================
// 4. PROFIL SPEICHERN
// ==========================================
window.saveProfile = function() {
    const user = auth.currentUser;
    if(!user) return;
    const newName = document.getElementById('prof-name').value.trim();
    const newBio = document.getElementById('prof-bio').value.trim();
    if(!newName) return alert("Bitte gib einen Namen an!");

    db.collection("users").doc(user.uid).set({ displayName: newName, bio: newBio, email: user.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
    .then(() => { alert("✅ Profil erfolgreich gespeichert!"); document.getElementById('profile-title').innerText = newName; })
    .catch(error => alert("Fehler: " + error.message));
};

// ==========================================
// 5. NEWS & BILDER
// ==========================================
async function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; } }
                else { if (h > maxHeight) { w *= maxHeight / h; h = maxHeight; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
            };
        };
    });
}

window.uploadNewsWithImage = async function() {
    const title = document.getElementById('n-title').value;
    const content = document.getElementById('n-content').value;
    const type = document.getElementById('n-type').value;
    const fileEl = document.getElementById('n-image');
    const file = fileEl ? fileEl.files[0] : null;
    const btn = document.getElementById('post-btn');
    const prog = document.getElementById('upload-progress');

    if(!title || !content) return alert("Titel und Inhalt fehlen!");
    btn.disabled = true;
    let url = "";

    if (file) {
        prog.style.display = "block";
        prog.innerText = "Komprimiere Bild...";
        const compressed = await compressImage(file, 1200, 1200, 0.8);
        const ref = storage.ref(`news_images/${Date.now()}_img.jpg`);
        const task = ref.put(compressed);
        
        await new Promise((res, rej) => {
            task.on('state_changed', 
                s => { prog.innerText = "Upload: " + Math.round((s.bytesTransferred/s.totalBytes)*100) + "%"; }, 
                rej, async () => { url = await task.snapshot.ref.getDownloadURL(); res(); }
            );
        });
    }

    db.collection("news").add({ title, content, type, image: url, timestamp: firebase.firestore.FieldValue.serverTimestamp() })
    .then(() => { alert("News veröffentlicht!"); window.location.href = "index.html"; });
};

function loadNews() {
    const list = document.getElementById('news-list');
    if(!list) return;

    db.collection("news").orderBy("timestamp", "desc").limit(10).onSnapshot(snap => {
        list.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            const newsId = doc.id;
            const color = d.type === 'patchnotes' ? 'var(--patch-color)' : (d.type === 'changelog' ? 'var(--change-color)' : 'var(--primary)');
            const img = d.image ? `<img src="${d.image}" style="max-width:100%; max-height:400px; border-radius:8px; margin-top:10px; border:1px solid ${color}; display:block;">` : '';
            const del = isAdmin ? `<button onclick="deleteDoc('news', '${newsId}')" style="background:red; color:white; border:none; padding:8px; margin-top:15px; cursor:pointer; border-radius:4px;">🗑️ Beitrag Löschen</button>` : '';
            
            const commentSection = `
                <div style="margin-top: 25px; border-top: 1px solid #333; padding-top: 15px;">
                    <h4 style="margin-bottom: 10px; color: #ccc;">💬 Kommentare</h4>
                    <div id="comments-box-${newsId}" style="max-height: 250px; overflow-y: auto; margin-bottom: 15px;">
                        <p style="font-size: 0.85rem; color: gray;">Lade Kommentare...</p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="comment-input-${newsId}" placeholder="Schreibe einen Kommentar..." class="editor-input" style="margin-bottom: 0;">
                        <button onclick="postComment('${newsId}')" class="save-btn" style="width: auto; padding: 0 20px;">Senden</button>
                    </div>
                </div>`;

            list.innerHTML += `
                <div class="project-card" style="border-left-color: ${color}">
                    <span class="card-badge" style="background:${color}; color:black;">${d.type.toUpperCase()}</span>
                    <h3>${d.title}</h3>
                    ${img}
                    <p style="white-space:pre-wrap; margin-top:15px;">${d.content}</p>
                    ${del}
                    ${commentSection}
                </div>`;
                
            loadComments(newsId);
        });
    });
}

// ==========================================
// 6. KOMMENTARE
// ==========================================
window.postComment = function(newsId) {
    const user = auth.currentUser;
    const textEl = document.getElementById(`comment-input-${newsId}`);
    if(!textEl) return;
    const text = textEl.value;

    if(!user) return alert("Du musst eingeloggt sein, um zu kommentieren!");
    if(!text.trim()) return;

    db.collection("users").doc(user.uid).get().then(userDoc => {
        const name = (userDoc.exists && userDoc.data().displayName) ? userDoc.data().displayName : user.email.split('@')[0];
        db.collection("comments").add({ newsId: newsId, userId: user.uid, userName: name, text: text, timestamp: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => { textEl.value = ""; });
    });
};

function loadComments(newsId) {
    const box = document.getElementById(`comments-box-${newsId}`);
    if(!box) return;
    db.collection("comments").where("newsId", "==", newsId).orderBy("timestamp", "asc").onSnapshot(snap => {
        box.innerHTML = "";
        if(snap.empty) { box.innerHTML = '<p style="font-size:0.85rem; color:gray;">Noch keine Kommentare.</p>'; return; }
        
        snap.forEach(doc => {
            const c = doc.data();
            const delBtn = isAdmin ? `<span onclick="deleteDoc('comments', '${doc.id}')" style="color:red; cursor:pointer; float:right; font-size:0.8rem;">❌</span>` : '';
            box.innerHTML += `
                <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; margin-top: 8px; font-size: 0.9rem; border: 1px solid #222;">
                    <strong style="color:var(--primary)">${c.userName}</strong> ${delBtn}
                    <div style="margin-top: 5px; color: #ccc;">${c.text}</div>
                </div>`;
        });
    });
}

// ==========================================
// 7. HELPER & POSTFACH
// ==========================================
window.deleteDoc = function(collectionName, docId) { 
    if(confirm("Diesen Eintrag unwiderruflich löschen?")) db.collection(collectionName).doc(docId).delete(); 
};

window.sendSupport = function(e) {
    e.preventDefault();
    const user = auth.currentUser;
    const name = document.getElementById('sup-name').value;
    const message = document.getElementById('sup-msg').value;
    const mailToSave = user ? user.email : null; 
    
    db.collection("messages").add({ name, message, email: mailToSave, timestamp: firebase.firestore.FieldValue.serverTimestamp() })
    .then(() => { alert("Nachricht gesendet!"); e.target.reset(); });
};

function renderAdminMessages() {
    const list = document.getElementById('admin-messages');
    if(!list) return;
    db.collection("messages").orderBy("timestamp", "desc").onSnapshot(snap => {
        list.innerHTML = "";
        snap.forEach(doc => {
            const m = doc.data();
            const date = m.timestamp ? m.timestamp.toDate().toLocaleString() : "Gerade eben";
            const replyBtn = m.email ? `<a href="mailto:${m.email}?subject=Re: Support Anfrage Creeperflori" class="save-btn btn-highlight" style="text-decoration:none; display:inline-block; width:auto; padding: 8px 15px; margin-top:10px;">📧 Antworten</a>` : `<p style="font-size:0.8rem; color:gray; margin-top:10px;">(Gast)</p>`;

            list.innerHTML += `
                <div class="project-card" style="border-left-color: #ff9900;">
                    <small style="color:gray;">📅 ${date}</small>
                    <h3 style="margin-top:5px;">Von: ${m.name}</h3>
                    <p style="margin: 15px 0; background: #111; padding: 15px; border-radius: 8px; font-style: italic;">"${m.message}"</p>
                    <div style="display:flex; justify-content: space-between; align-items: center;">
                        ${replyBtn}
                        <button onclick="deleteDoc('messages', '${doc.id}')" style="background:none; border:1px solid red; color:red; cursor:pointer; padding: 8px 15px; border-radius: 5px; font-weight:bold;">🗑️ Löschen</button>
                    </div>
                </div>`;
        });
    });
}

// Hintergrund Animation
document.addEventListener("DOMContentLoaded", () => {
    applyLinks();
    const canvas = document.getElementById('bgCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    let p = Array.from({length: 40}, () => ({x: Math.random()*canvas.width, y: Math.random()*canvas.height, v: Math.random()*-0.8-0.2}));
    function draw() {
        ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle = "#32CD32";
        p.forEach(i => { i.y += i.v; if(i.y < -10) i.y = canvas.height+10; ctx.globalAlpha = 0.2; ctx.fillRect(i.x, i.y, 2, 2); });
        requestAnimationFrame(draw);
    }
    draw();
});
