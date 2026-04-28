// ==========================================
// 1. INITIALISIERUNG AUS DER CONFIG.JS
// ==========================================
// Firebase wird mit den Daten aus CONFIG.firebase gestartet
firebase.initializeApp(CONFIG.firebase);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

let currentUserProfile = null; 
let isAdmin = false; 

// ==========================================
// 2. LINKS VERTEILEN (Dynamic Links)
// ==========================================
function applyLinks() {
    const setLink = (id, url) => {
        const el = document.getElementById(id);
        if(el) {
            if(el.tagName === 'A') el.href = url;
            else el.innerText = url;
        }
    };
    // Nutzt die Links aus der config.js
    setLink('link-twitch', CONFIG.links.twitch);
    setLink('link-yt', CONFIG.links.youtube);
    setLink('link-tt', CONFIG.links.tiktok);
    setLink('link-insta', CONFIG.links.instagram);
    setLink('link-discord', CONFIG.links.deppenCord);
    setLink('link-server-discord', CONFIG.links.serverDiscord); 
    setLink('text-ip', CONFIG.links.serverIP);
}

// ==========================================
// 3. AUTH & LOGIN LOGIK
// ==========================================
auth.onAuthStateChanged(user => {
    applyLinks(); // Links laden
    const adminPanel = document.getElementById('admin-panel');
    const loginBtns = document.querySelectorAll('.user-login-btn');
    
    if (user) {
        // Prüfen, ob der User die Admin-Mail aus der config.js hat
        isAdmin = (user.email === CONFIG.adminEmail);
        
        db.collection('users').doc(user.uid).onSnapshot(doc => {
            let name = user.email.split('@')[0];
            if (doc.exists && doc.data().displayName) name = doc.data().displayName;
            currentUserProfile = { displayName: name };
            loginBtns.forEach(btn => {
                btn.innerHTML = "👤 " + name;
                btn.onclick = () => window.location.href = "profil.html"; // WICHTIG: Endet jetzt auf .html
            });
        });
        if(isAdmin && adminPanel) adminPanel.style.display = "block";
    } else {
        isAdmin = false;
        loginBtns.forEach(btn => {
            btn.innerHTML = "LOGIN";
            btn.onclick = openLoginModal;
        });
        if(adminPanel) adminPanel.style.display = "none";
    }
    
    // News laden, falls wir auf der Startseite sind
    if(document.getElementById('news-list')) loadNews();
});

function openLoginModal() { document.getElementById('login-modal').style.display = "flex"; }
function closeLoginModal() { document.getElementById('login-modal').style.display = "none"; }

function handleAuth(action) {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    if(!email || !pass) return alert("Bitte alle Felder ausfüllen!");
    
    if(action === 'register') {
        if(!document.getElementById('legal-check').checked) return alert("Bitte akzeptiere die Datenschutzerklärung!");
        auth.createUserWithEmailAndPassword(email, pass)
            .then(() => location.reload())
            .catch(e => alert("Fehler: " + e.message));
    } else {
        auth.signInWithEmailAndPassword(email, pass)
            .then(() => closeLoginModal())
            .catch(e => alert("Login fehlgeschlagen!"));
    }
}

// ==========================================
// 4. EDITOR & BILDER
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
    const file = document.getElementById('n-image').files[0];
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
                rej, 
                async () => { url = await task.snapshot.ref.getDownloadURL(); res(); }
            );
        });
    }

    db.collection("news").add({ title, content, type, image: url, timestamp: firebase.firestore.FieldValue.serverTimestamp() })
    .then(() => location.reload());
};

function loadNews() {
    const list = document.getElementById('news-list');
    db.collection("news").orderBy("timestamp", "desc").limit(10).onSnapshot(snap => {
        list.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            const color = d.type === 'patchnotes' ? 'var(--patch-color)' : (d.type === 'changelog' ? 'var(--change-color)' : 'var(--primary)');
            const img = d.image ? `<img src="${d.image}" style="max-width:100%; max-height:400px; border-radius:8px; margin-top:10px; border:1px solid ${color}; display:block;">` : '';
            const del = isAdmin ? `<button onclick="deleteNews('${doc.id}')" style="background:red; color:white; border:none; padding:8px; margin-top:15px; cursor:pointer; border-radius:4px;">🗑️ Beitrag Löschen</button>` : '';
            
            list.innerHTML += `
                <div class="project-card" style="border-left-color: ${color}">
                    <span class="card-badge" style="background:${color}; color:black;">${d.type.toUpperCase()}</span>
                    <h3>${d.title}</h3>
                    ${img}
                    <p style="white-space:pre-wrap; margin-top:15px;">${d.content}</p>
                    ${del}
                </div>`;
        });
    });
}
window.deleteNews = function(id) { if(confirm("Wirklich löschen?")) db.collection("news").doc(id).delete(); };

// ==========================================
// 5. HELPER FUNKTIONEN & ANIMATION
// ==========================================
window.sendSupport = function(e) {
    e.preventDefault();
    const name = document.getElementById('sup-name').value;
    const message = document.getElementById('sup-msg').value;
    db.collection("messages").add({ name, message, timestamp: firebase.firestore.FieldValue.serverTimestamp() })
    .then(() => { alert("Nachricht an Creeperflori gesendet!"); e.target.reset(); });
};

document.addEventListener("DOMContentLoaded", () => {
    applyLinks();
    const canvas = document.getElementById('bgCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    let p = Array.from({length: 30}, () => ({x: Math.random()*canvas.width, y: Math.random()*canvas.height, v: Math.random()*-0.8-0.2}));
    function draw() {
        ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle = "#32CD32";
        p.forEach(i => { i.y += i.v; if(i.y < -10) i.y = canvas.height+10; ctx.globalAlpha = 0.2; ctx.fillRect(i.x, i.y, 2, 2); });
        requestAnimationFrame(draw);
    }
    draw();
});
