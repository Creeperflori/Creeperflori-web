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
        if(el) { if(el.tagName === 'A') el.href = url; else el.innerText = url; }
    };
    setLink('link-twitch', CONFIG.links.twitch);
    setLink('link-yt', CONFIG.links.youtube);
    setLink('link-tt', CONFIG.links.tiktok);
    setLink('link-insta', CONFIG.links.instagram);
    setLink('link-discord', CONFIG.links.deppenCord);
    setLink('link-partner-discord', CONFIG.links.deppenCord); 
    setLink('text-ip', CONFIG.links.serverIP);
}

// ==========================================
// 3. MASTER-STEUERUNG & AUTH
// ==========================================
auth.onAuthStateChanged(user => {
    applyLinks(); 
    const adminNavLink = document.getElementById('admin-nav-link');
    const loginBtns = document.querySelectorAll('.user-login-btn');
    const guestFields = document.querySelectorAll('.guest-contact');
    const path = window.location.pathname;
    
    if (user) {
        guestFields.forEach(f => { f.style.display = 'none'; f.required = false; });
        const uEmail = user.email ? user.email.trim().toLowerCase() : "";
        const aEmail = CONFIG.adminEmail ? CONFIG.adminEmail.trim().toLowerCase() : "";
        isAdmin = (uEmail === aEmail && uEmail !== "");

        db.collection('users').doc(user.uid).onSnapshot(doc => {
            let name = user.email.split('@')[0];
            if (doc.exists && doc.data().displayName) name = doc.data().displayName;
            loginBtns.forEach(btn => {
                btn.innerHTML = "👤 " + name;
                btn.onclick = () => window.location.href = "profil.html";
            });
        });

        if(isAdmin && adminNavLink) adminNavLink.style.display = "inline-block";
        
        // Admin Routing
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
        if(adminNavLink) adminNavLink.style.display = "none";
        guestFields.forEach(f => { f.style.display = 'block'; f.required = true; });
        if (path.includes('profil.html') || path.includes('admin.html')) window.location.replace("index.html");
    }
    
    if(document.getElementById('news-list') || document.getElementById('fillypath-news-list')) loadNews();
});

// ==========================================
// 4. MODAL STEUERUNG (LOGIN & DATENSCHUTZ)
// ==========================================
function openLoginModal() { document.getElementById('login-modal').style.display = "flex"; }
function closeLoginModal() { document.getElementById('login-modal').style.display = "none"; }

window.openDatenschutzModal = function() { document.getElementById('datenschutz-modal').style.display = "flex"; };
window.closeDatenschutzModal = function() { document.getElementById('datenschutz-modal').style.display = "none"; };

window.handleAuth = function(action) {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    if(!email || !pass) return alert("Bitte E-Mail und Passwort eingeben!");
    
    if(action === 'register') {
        const checkbox = document.getElementById('legal-check');
        if(checkbox && !checkbox.checked) return alert("Bitte akzeptiere die Datenschutzerklärung!");
        auth.createUserWithEmailAndPassword(email, pass).then(() => location.reload()).catch(e => alert(e.message));
    } else {
        auth.signInWithEmailAndPassword(email, pass).then(() => closeLoginModal()).catch(e => alert("Login fehlgeschlagen!"));
    }
};

window.logoutUser = function() { auth.signOut().then(() => location.reload()); };

window.resetPassword = function() {
    const email = document.getElementById('auth-email').value;
    if(!email) return alert("Bitte gib oben im Feld zuerst deine E-Mail-Adresse ein!");
    auth.sendPasswordResetEmail(email).then(() => alert("✅ Reset-E-Mail gesendet! Prüfe dein Postfach.")).catch(e => alert("Fehler: " + e.message));
};

// ==========================================
// 5. NEWS LADEN
// ==========================================
function loadNews() {
    const isFilly = window.location.pathname.includes('fillypath.html');
    const targetCat = isFilly ? 'fillypath' : 'general';
    const list = document.getElementById(isFilly ? 'fillypath-news-list' : 'news-list');
    if(!list) return;

    db.collection("news").orderBy("timestamp", "desc").limit(20).onSnapshot(snap => {
        list.innerHTML = "";
        let count = 0;
        snap.forEach(doc => {
            const d = doc.data();
            if ((d.category || 'general') !== targetCat) return;
            count++;

            const color = d.type === 'patchnotes' ? 'var(--patch-color)' : (d.type === 'changelog' ? '#00ccff' : 'var(--primary)');
            const img = d.image ? `<img src="${d.image}" style="max-width:100%; border-radius:8px; margin-top:10px;">` : '';
            const del = isAdmin ? `<button onclick="deleteDoc('news', '${doc.id}')" style="background:red; color:white; border:none; padding:8px; margin-top:10px; border-radius:4px; cursor:pointer;">🗑 Löschen</button>` : '';
            
            list.innerHTML += `
                <div class="project-card" style="border-left-color: ${color}">
                    <span class="card-badge" style="background:${color}; color:black;">${d.type.toUpperCase()}</span>
                    <h3>${d.title}</h3>
                    ${img}
                    <p style="white-space:pre-wrap; margin-top:10px;">${d.content}</p>
                    ${del}
                </div>`;
        });
        if(count === 0) list.innerHTML = "<p style='text-align:center; color:gray;'>Keine News vorhanden.</p>";
    });
}

// Löschen-Funktion (Hilfsfunktion für Admins)
window.deleteDoc = function(col, id) { if(confirm("Endgültig löschen?")) db.collection(col).doc(id).delete(); };

// ==========================================
// 6. SUPPORT SYSTEM (Die intelligente Box)
// ==========================================
window.toggleSupportFields = function() {
    const cat = document.getElementById('sup-category').value;
    const mc = document.getElementById('mc-fields');
    const dc = document.getElementById('discord-fields');
    if(mc) mc.style.display = (cat === 'minecraft') ? 'block' : 'none';
    if(dc) dc.style.display = (cat === 'discord') ? 'block' : 'none';
};

window.sendSupport = function(e) {
    e.preventDefault();
    const user = auth.currentUser;
    const contact = document.getElementById('sup-contact').value;
    
    if(!user && !contact) return alert("Bitte Kontaktmöglichkeit (E-Mail oder Discord) angeben!");

    const data = {
        name: document.getElementById('sup-name').value,
        message: document.getElementById('sup-msg').value,
        category: document.getElementById('sup-category').value,
        email: user ? user.email : contact,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    if(data.category === 'minecraft') {
        data.mcName = document.getElementById('sup-mc-name').value;
        data.platform = document.getElementById('sup-platform').value;
    } else if(data.category === 'discord') {
        data.discordName = document.getElementById('sup-discord-name').value;
    }

    db.collection("messages").add(data).then(() => {
        alert("Deine Anfrage wurde erfolgreich gesendet!");
        e.target.reset();
        window.toggleSupportFields();
    });
};

// ==========================================
// 7. ADMIN DASHBOARD TICKET SYSTEM
// ==========================================
function renderAdminMessages() {
    const list = document.getElementById('admin-messages');
    if(!list) return;

    db.collection("messages").orderBy("timestamp", "desc").onSnapshot(snap => {
        list.innerHTML = "";
        let count = 0;
        
        snap.forEach(doc => {
            count++;
            const m = doc.data();
            
            const badgeColor = m.category === 'minecraft' ? '#32CD32' : (m.category === 'discord' ? '#5865F2' : '#ff9900');
            const fontColor = m.category === 'allgemein' ? 'black' : 'white';
            
            let extraInfo = '';
            if(m.category === 'minecraft') {
                extraInfo = `<div style="background: rgba(50, 205, 50, 0.1); padding: 10px; border-radius: 5px; margin-top: 10px; border-left: 3px solid #32CD32;">
                                <p style="margin: 0; font-size: 0.9rem;"><strong>MC-Name:</strong> ${m.mcName || '-'} <br> <strong>Plattform:</strong> ${m.platform || '-'}</p>
                             </div>`;
            } else if(m.category === 'discord') {
                extraInfo = `<div style="background: rgba(88, 101, 242, 0.1); padding: 10px; border-radius: 5px; margin-top: 10px; border-left: 3px solid #5865F2;">
                                <p style="margin: 0; font-size: 0.9rem;"><strong>Discord-Name:</strong> ${m.discordName || '-'}</p>
                             </div>`;
            }

            const time = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleString('de-DE') : 'Gerade eben';
            
            const replyLink = m.email && m.email.includes('@') 
                ? `<a href="mailto:${m.email}" class="save-btn btn-highlight" style="text-decoration:none; display:inline-block; width:auto; padding:8px 20px;">Antworten</a>` 
                : `<span style="color:#ff9900; font-size: 0.8rem;">(Keine Email / Nur Discord)</span>`;

            list.innerHTML += `
                <div class="project-card" style="border-left-color:${badgeColor}; margin-bottom: 30px;">
                    <span class="card-badge" style="background:${badgeColor}; color:${fontColor};">${(m.category || 'allgemein').toUpperCase()}</span>
                    
                    <div style="margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                        <h3 style="margin-bottom: 5px;">Von: ${m.name}</h3>
                        <p style="font-size: 0.8rem; color: gray;">Gesendet am: ${time}</p>
                        <p style="font-size: 0.9rem; color: #ccc;"><strong>Kontakt:</strong> ${m.email}</p>
                    </div>

                    ${extraInfo}
                    
                    <div style="background:#0a0a0a; padding:15px; border-radius:8px; margin:15px 0; border: 1px solid #222;">
                        <p style="white-space: pre-wrap; margin: 0; font-style: italic;">"${m.message}"</p>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items: center; margin-top: 20px;">
                        ${replyLink}
                        <button onclick="deleteDoc('messages', '${doc.id}')" style="color:#ff4444; background:transparent; border:1px solid #ff4444; padding:8px 20px; border-radius:5px; cursor:pointer; transition: 0.3s;">🗑️ Schließen / Löschen</button>
                    </div>
                </div>`;
        });
        
        if(count === 0) list.innerHTML = "<p style='text-align:center; color:gray; font-size: 1.2rem; padding: 40px;'>Alles erledigt! Keine Support-Tickets offen. 🎉</p>";
    });
}

// ==========================================
// 8. HINTERGRUND ANIMATION
// ==========================================
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
