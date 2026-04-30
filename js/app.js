firebase.initializeApp(CONFIG.firebase);
const db = firebase.firestore();
const auth = firebase.auth();

// LOGIN / MODAL LOGIK
function openLoginModal() { document.getElementById('login-modal').style.display = 'flex'; }
function closeLoginModal() { document.getElementById('login-modal').style.display = 'none'; }

auth.onAuthStateChanged(user => {
    const loginBtns = document.querySelectorAll('.user-login-btn');
    const guestFields = document.querySelectorAll('.guest-contact');
    
    if (user) {
        guestFields.forEach(f => f.style.display = 'none');
        loginBtns.forEach(btn => {
            btn.innerText = "PROFIL";
            btn.onclick = () => window.location.href = 'profil.html';
        });
    } else {
        guestFields.forEach(f => f.style.display = 'block');
        loginBtns.forEach(btn => {
            btn.innerText = "LOGIN";
            btn.onclick = openLoginModal;
        });
    }
    // News laden falls auf der richtigen Seite
    if(document.getElementById('news-list')) loadNews();
});

// PASSWORT VERGESSEN
window.resetPassword = function() {
    const email = document.getElementById('auth-email').value;
    if(!email) return alert("Gib erst deine E-Mail ein!");
    auth.sendPasswordResetEmail(email).then(() => alert("E-Mail gesendet!"));
};

// SUPPORT SENDEN
window.sendSupport = function(e) {
    e.preventDefault();
    const user = auth.currentUser;
    const contact = document.getElementById('sup-contact').value;
    const msg = document.getElementById('sup-msg').value;

    db.collection("messages").add({
        name: document.getElementById('sup-name').value,
        email: user ? user.email : contact,
        message: msg,
        category: document.getElementById('sup-category').value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("Nachricht gesendet!");
        e.target.reset();
    });
};

// NEWS LADEN (Beispiel)
function loadNews() {
    const list = document.getElementById('news-list');
    db.collection("news").orderBy("timestamp", "desc").limit(10).onSnapshot(snap => {
        list.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            list.innerHTML += `<div class="project-card"><h3>${d.title}</h3><p>${d.content}</p></div>`;
        });
    });
}
