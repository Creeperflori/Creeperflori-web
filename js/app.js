firebase.initializeApp(CONFIG.firebase);

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

let isAdmin = false;
let globalStatusTimer = null;
let siteSettings = null;

const DEFAULT_SITE_SETTINGS = {
    sections: {
        fillypathEnabled: true,
        creepercaveEnabled: true,
        partnerDiscordEnabled: true,
        supportEnabled: true
    }
};

const TYPE_META = {
    news: { label: "News", color: "#7ee787" },
    patchnotes: { label: "Patchnotes", color: "#ffbd5c" },
    changelog: { label: "Changelog", color: "#6ec6ff" }
};

const CATEGORY_META = {
    allgemein: { label: "Allgemein", color: "#ffbd5c" },
    discord: { label: "Discord", color: "#7c8cff" },
    minecraft: { label: "Fillypath", color: "#7ee787" }
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function normalizeSiteSettings(data = {}) {
    return {
        sections: {
            ...DEFAULT_SITE_SETTINGS.sections,
            ...(data.sections || {})
        }
    };
}

function getSettingsDoc() {
    return db.collection("site_config").doc("main");
}

function isSectionEnabled(key) {
    const sections = siteSettings?.sections || DEFAULT_SITE_SETTINGS.sections;
    return sections[key] !== false;
}

function toggleElementDisplay(element, shouldShow, displayValue = "") {
    if (!element) return;
    element.style.display = shouldShow ? displayValue : "none";
}

function applySiteSettingsToPage() {
    const featureElements = document.querySelectorAll("[data-feature]");
    featureElements.forEach((element) => {
        const featureKey = element.getAttribute("data-feature");
        const enabled = isSectionEnabled(featureKey);
        const displayValue = element.getAttribute("data-display") || "";
        toggleElementDisplay(element, enabled, displayValue);
    });

    const disabledInfoElements = document.querySelectorAll("[data-feature-disabled]");
    disabledInfoElements.forEach((element) => {
        const featureKey = element.getAttribute("data-feature-disabled");
        const enabled = isSectionEnabled(featureKey);
        const displayValue = element.getAttribute("data-display") || "";
        toggleElementDisplay(element, !enabled, displayValue);
    });

    const supportForms = document.querySelectorAll("#support-form");
    supportForms.forEach((form) => {
        const enabled = isSectionEnabled("supportEnabled");
        toggleElementDisplay(form, enabled);
    });

    document.querySelectorAll("[data-support-disabled]").forEach((element) => {
        toggleElementDisplay(element, !isSectionEnabled("supportEnabled"));
    });

    const fillypathCategory = document.querySelector('#sup-category option[value="minecraft"]');
    if (fillypathCategory) {
        fillypathCategory.disabled = !isSectionEnabled("fillypathEnabled");
        fillypathCategory.hidden = !isSectionEnabled("fillypathEnabled");
    }

    const discordCategory = document.querySelector('#sup-category option[value="discord"]');
    if (discordCategory) {
        discordCategory.disabled = !isSectionEnabled("creepercaveEnabled");
        discordCategory.hidden = !isSectionEnabled("creepercaveEnabled");
    }

    const categorySelect = document.getElementById("sup-category");
    if (categorySelect) {
        if (categorySelect.value === "minecraft" && !isSectionEnabled("fillypathEnabled")) {
            categorySelect.value = "allgemein";
        }
        if (categorySelect.value === "discord" && !isSectionEnabled("creepercaveEnabled")) {
            categorySelect.value = "allgemein";
        }
    }

    const featureInputs = document.querySelectorAll("[data-settings-input]");
    featureInputs.forEach((input) => {
        const key = input.getAttribute("data-settings-input");
        input.checked = isSectionEnabled(key);
    });

    if (document.getElementById("support-form")) {
        window.toggleSupportFields();
    }
}

function watchSiteSettings() {
    getSettingsDoc().onSnapshot((doc) => {
        siteSettings = normalizeSiteSettings(doc.exists ? doc.data() : {});
        applySiteSettingsToPage();
    }, () => {
        siteSettings = normalizeSiteSettings({});
        applySiteSettingsToPage();
    });
}

function applyLinks() {
    const setHref = (id, url) => {
        const element = document.getElementById(id);
        if (!element || !url) return;
        if (element.tagName === "A") {
            element.href = url;
        } else {
            element.textContent = url;
        }
    };

    setHref("link-twitch", CONFIG.links.twitch);
    setHref("link-yt", CONFIG.links.youtube);
    setHref("link-tt", CONFIG.links.tiktok);
    setHref("link-insta", CONFIG.links.instagram);
    setHref("link-discord", CONFIG.links.deppenCord);
    setHref("link-partner-discord", CONFIG.links.deppenCord);
    setHref("link-server-discord", CONFIG.links.serverDiscord);
    setHref("link-creepercave", CONFIG.links.creeperCave || CONFIG.links.deppenCord);

    const serverIp = document.getElementById("text-ip");
    if (serverIp) {
        serverIp.textContent = CONFIG.links.serverIP || "fillypath.de";
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function statusClass(type) {
    if (type === "success" || type === "error" || type === "warning") return type;
    return "info";
}

function renderStatus(element, message, type = "info") {
    if (!element) return;
    if (!message) {
        element.className = "status-box";
        element.textContent = "";
        return;
    }
    element.className = `status-box is-visible is-${statusClass(type)}`;
    element.textContent = message;
}

function showGlobalStatus(message, type = "info", timeout = 5000) {
    const box = document.getElementById("site-status-message");
    if (!box) return;
    renderStatus(box, message, type);
    if (globalStatusTimer) {
        window.clearTimeout(globalStatusTimer);
    }
    if (timeout > 0) {
        globalStatusTimer = window.setTimeout(() => renderStatus(box, ""), timeout);
    }
}

function getFormStatus(formId) {
    return document.querySelector(`[data-status-for="${formId}"]`);
}

function setButtonLoading(button, isLoading, loadingText, idleText) {
    if (!button) return;
    if (typeof button.dataset.idleText === "undefined") {
        button.dataset.idleText = idleText || button.textContent;
    }
    if (loadingText) {
        button.dataset.loadingText = loadingText;
    }
    button.disabled = isLoading;
    button.textContent = isLoading ? (button.dataset.loadingText || loadingText || "Lade...") : button.dataset.idleText;
}

function toggleModal(id, shouldOpen) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.toggle("is-open", shouldOpen);
    document.body.classList.toggle("modal-open", Boolean(shouldOpen || document.querySelector(".modal-overlay.is-open")));
}

window.openLoginModal = function openLoginModal() {
    toggleModal("login-modal", true);
};

window.closeLoginModal = function closeLoginModal() {
    toggleModal("login-modal", false);
};

window.openDatenschutzModal = function openDatenschutzModal() {
    toggleModal("datenschutz-modal", true);
};

window.closeDatenschutzModal = function closeDatenschutzModal() {
    toggleModal("datenschutz-modal", false);
};

window.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.classList.contains("modal-overlay")) {
        target.classList.remove("is-open");
        document.body.classList.toggle("modal-open", Boolean(document.querySelector(".modal-overlay.is-open")));
    }
});

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        document.querySelectorAll(".modal-overlay.is-open").forEach((modal) => modal.classList.remove("is-open"));
        document.body.classList.remove("modal-open");
    }
});

function getFriendlyAuthMessage(error, fallback) {
    const code = error?.code || "";
    const messages = {
        "auth/invalid-email": "Bitte gib eine gültige E-Mail-Adresse ein.",
        "auth/user-not-found": "Zu dieser E-Mail wurde kein Konto gefunden.",
        "auth/wrong-password": "Das Passwort ist nicht korrekt.",
        "auth/invalid-login-credentials": "E-Mail oder Passwort stimmen nicht.",
        "auth/email-already-in-use": "Zu dieser E-Mail gibt es bereits einen Account.",
        "auth/weak-password": "Bitte wähle ein stärkeres Passwort mit mindestens 6 Zeichen.",
        "auth/too-many-requests": "Zu viele Versuche. Bitte warte kurz und probiere es erneut.",
        "auth/network-request-failed": "Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut."
    };
    return messages[code] || fallback || "Etwas ist schiefgelaufen. Bitte versuche es noch einmal.";
}

window.handleAuth = async function handleAuth(action) {
    const statusBox = getFormStatus("login-form");
    const submitButton = document.querySelector("#login-form button[type='submit']");
    const registerButton = document.querySelector("#login-form [data-register-button]");
    const email = document.getElementById("auth-email")?.value.trim();
    const password = document.getElementById("auth-pass")?.value;

    if (!email || !password) {
        renderStatus(statusBox, "Bitte gib E-Mail und Passwort ein.", "warning");
        return;
    }

    if (action === "register") {
        const checkbox = document.getElementById("legal-check");
        if (checkbox && !checkbox.checked) {
            renderStatus(statusBox, "Bitte akzeptiere die Datenschutzerklärung, um ein Konto zu erstellen.", "warning");
            return;
        }
    }

    renderStatus(statusBox, action === "register" ? "Account wird erstellt..." : "Anmeldung wird geprüft...", "info");
    setButtonLoading(submitButton, action !== "register", "Einloggen...", submitButton?.textContent);
    setButtonLoading(registerButton, action === "register", "Registriere...", registerButton?.textContent);

    try {
        if (action === "register") {
            await auth.createUserWithEmailAndPassword(email, password);
            renderStatus(statusBox, "Dein Account wurde erstellt. Du bist jetzt eingeloggt.", "success");
            showGlobalStatus("Willkommen in der Community.", "success");
            window.setTimeout(() => closeLoginModal(), 700);
        } else {
            await auth.signInWithEmailAndPassword(email, password);
            renderStatus(statusBox, "Erfolgreich eingeloggt. Willkommen zurück.", "success");
            showGlobalStatus("Login erfolgreich.", "success");
            window.setTimeout(() => closeLoginModal(), 700);
        }
    } catch (error) {
        renderStatus(statusBox, getFriendlyAuthMessage(error, "Login fehlgeschlagen."), "error");
    } finally {
        setButtonLoading(submitButton, false);
        setButtonLoading(registerButton, false);
    }
};

window.logoutUser = async function logoutUser() {
    try {
        await auth.signOut();
        showGlobalStatus("Du wurdest erfolgreich ausgeloggt.", "success");
        if (window.location.pathname.includes("profil.html") || window.location.pathname.includes("admin.html")) {
            window.location.replace("start.html");
        }
    } catch (error) {
        showGlobalStatus("Logout fehlgeschlagen. Bitte versuche es erneut.", "error");
    }
};

window.resetPassword = async function resetPassword() {
    const emailField = document.getElementById("auth-email");
    const email = emailField?.value.trim() || auth.currentUser?.email || "";
    const statusBox = getFormStatus("login-form") || getFormStatus("profile-form");

    if (!email) {
        renderStatus(statusBox, "Bitte gib zuerst eine E-Mail-Adresse ein.", "warning");
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);
        renderStatus(statusBox, "Die Reset-Mail wurde gesendet. Bitte prüfe dein Postfach.", "success");
        showGlobalStatus("Passwort-Reset wurde versendet.", "success");
    } catch (error) {
        renderStatus(statusBox, getFriendlyAuthMessage(error, "Reset-Mail konnte nicht gesendet werden."), "error");
    }
};

async function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const image = new Image();
            image.src = event.target.result;
            image.onload = () => {
                const canvas = document.createElement("canvas");
                let width = image.width;
                let height = image.height;

                if (width > height && width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                } else if (height >= width && height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }

                canvas.width = width;
                canvas.height = height;
                canvas.getContext("2d").drawImage(image, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
            };
        };
    });
}

window.uploadNewsWithImage = async function uploadNewsWithImage() {
    const title = document.getElementById("n-title")?.value.trim();
    const content = document.getElementById("n-content")?.value.trim();
    const type = document.getElementById("n-type")?.value || "news";
    const category = document.getElementById("n-category")?.value || "general";
    const fileInput = document.getElementById("n-image");
    const file = fileInput?.files?.[0] || null;
    const button = document.getElementById("post-btn");
    const statusBox = getFormStatus("admin-news-form");

    if (!title || !content) {
        renderStatus(statusBox, "Bitte fülle Titel und Inhalt aus.", "warning");
        return;
    }

    setButtonLoading(button, true, "Veröffentliche...");
    renderStatus(statusBox, "Beitrag wird hochgeladen...", "info");

    try {
        let imageUrl = "";
        if (file) {
            const compressed = await compressImage(file, 1400, 1400, 0.82);
            const ref = storage.ref(`news_images/${Date.now()}_img.jpg`);
            const task = await ref.put(compressed);
            imageUrl = await task.ref.getDownloadURL();
        }

        await db.collection("news").add({
            title,
            content,
            type,
            category,
            image: imageUrl,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById("admin-news-form")?.reset();
        renderStatus(statusBox, "Deine News ist jetzt online.", "success");
        showGlobalStatus("News erfolgreich veröffentlicht.", "success");
    } catch (error) {
        renderStatus(statusBox, `Beim Veröffentlichen ist ein Fehler aufgetreten: ${error.message}`, "error");
    } finally {
        setButtonLoading(button, false);
    }
};

window.saveSectionSettings = async function saveSectionSettings(event) {
    event.preventDefault();
    const statusBox = getFormStatus("admin-sections-form");
    const button = event.target.querySelector("button[type='submit']");
    const nextSettings = {
        sections: {
            fillypathEnabled: Boolean(document.querySelector('[data-settings-input="fillypathEnabled"]')?.checked),
            creepercaveEnabled: Boolean(document.querySelector('[data-settings-input="creepercaveEnabled"]')?.checked),
            partnerDiscordEnabled: Boolean(document.querySelector('[data-settings-input="partnerDiscordEnabled"]')?.checked),
            supportEnabled: Boolean(document.querySelector('[data-settings-input="supportEnabled"]')?.checked)
        }
    };

    setButtonLoading(button, true, "Speichere...");
    renderStatus(statusBox, "Sichtbarkeit wird gespeichert...", "info");

    try {
        await getSettingsDoc().set(nextSettings, { merge: true });
        renderStatus(statusBox, "Die Freischaltungen wurden gespeichert.", "success");
        showGlobalStatus("Bereiche erfolgreich aktualisiert.", "success");
    } catch (error) {
        const isPermissionError = error?.code === "permission-denied" || /insufficient permissions/i.test(error?.message || "");
        const message = isPermissionError
            ? "Speichern fehlgeschlagen: Firestore blockiert den Zugriff auf site_config/main. Erlaube Admins das Schreiben in dieser Collection."
            : `Speichern fehlgeschlagen: ${error.message}`;
        renderStatus(statusBox, message, "error");
    } finally {
        setButtonLoading(button, false);
    }
};

function createEmptyState(title, text) {
    return `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
}

function formatTimestamp(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") return "Gerade eben";
    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(timestamp.toDate());
}

function renderNewsCard(data, id) {
    const typeMeta = TYPE_META[data.type] || TYPE_META.news;
    const deleteAction = isAdmin
        ? `<div class="card-actions"><button class="btn btn-danger" onclick="deleteDoc('news', '${id}')">Beitrag löschen</button></div>`
        : "";
    const image = data.image ? `<img class="card-image" src="${escapeHtml(data.image)}" alt="${escapeHtml(data.title)}">` : "";
    const date = formatTimestamp(data.timestamp);

    return `
        <article class="project-card" style="--accent:${typeMeta.color}">
            <div class="card-top">
                <div>
                    <span class="card-badge" style="background:${typeMeta.color}; color:#06110d;">${escapeHtml(typeMeta.label)}</span>
                    <h3>${escapeHtml(data.title)}</h3>
                    <div class="news-meta">
                        <span class="news-date">${escapeHtml(date)}</span>
                    </div>
                </div>
            </div>
            <p>${escapeHtml(data.content).replace(/\n/g, "<br>")}</p>
            ${image}
            ${deleteAction}
        </article>
    `;
}

function loadNews() {
    const isFillyPage = window.location.pathname.includes("fillypath.html") || window.location.pathname.includes("minecraft.html");
    const targetCategory = isFillyPage ? "fillypath" : "general";
    const list = document.getElementById(isFillyPage ? "fillypath-news-list" : "news-list");
    if (!list) return;

    list.innerHTML = createEmptyState("Lade Inhalte...", "Die neuesten Updates werden geladen.");

    db.collection("news").orderBy("timestamp", "desc").limit(20).onSnapshot((snapshot) => {
        const cards = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if ((data.category || "general") !== targetCategory) return;
            cards.push(renderNewsCard(data, doc.id));
        });

        if (!cards.length) {
            const text = isFillyPage
                ? "Sobald es neue Patchnotes oder Server-Updates gibt, erscheinen sie hier."
                : "Sobald neue News live gehen, tauchen sie hier automatisch auf.";
            list.innerHTML = createEmptyState("Noch keine News vorhanden", text);
            return;
        }

        list.innerHTML = `<div class="news-stack">${cards.join("")}</div>`;
    }, () => {
        list.innerHTML = createEmptyState("News konnten nicht geladen werden", "Bitte versuche es später erneut.");
    });
}

window.deleteDoc = async function deleteDoc(collectionName, id) {
    if (!window.confirm("Diesen Eintrag wirklich löschen?")) return;
    try {
        await db.collection(collectionName).doc(id).delete();
        showGlobalStatus("Eintrag erfolgreich gelöscht.", "success");
    } catch (error) {
        showGlobalStatus("Löschen fehlgeschlagen. Bitte versuche es erneut.", "error");
    }
};

window.toggleSupportFields = function toggleSupportFields() {
    const category = document.getElementById("sup-category")?.value;
    const discordFields = document.getElementById("discord-fields");
    const mcFields = document.getElementById("mc-fields");
    const mcName = document.getElementById("sup-mc-name");
    const platform = document.getElementById("sup-platform");
    const discordName = document.getElementById("sup-discord-name");

    const showDiscord = category === "discord";
    const showMinecraft = category === "minecraft";

    if (discordFields) discordFields.style.display = showDiscord ? "block" : "none";
    if (mcFields) mcFields.style.display = showMinecraft ? "grid" : "none";

    if (discordName) discordName.required = showDiscord;
    if (mcName) mcName.required = showMinecraft;
    if (platform) platform.required = showMinecraft;
}

window.sendSupport = async function sendSupport(event) {
    event.preventDefault();
    if (!isSectionEnabled("supportEnabled")) {
        showGlobalStatus("Support ist gerade nicht freigeschaltet.", "warning");
        return;
    }
    const form = event.target;
    const user = auth.currentUser;
    const category = document.getElementById("sup-category")?.value || "allgemein";
    const contact = document.getElementById("sup-contact")?.value.trim();
    const statusBox = getFormStatus("support-form");
    const button = form.querySelector("button[type='submit']");

    if (!user && !contact) {
        renderStatus(statusBox, "Bitte gib eine Kontaktmöglichkeit für Rückfragen an.", "warning");
        return;
    }

    const payload = {
        name: document.getElementById("sup-name")?.value.trim(),
        message: document.getElementById("sup-msg")?.value.trim(),
        category,
        email: user ? user.email : contact,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!payload.name || !payload.message) {
        renderStatus(statusBox, "Bitte fülle Name und Nachricht aus.", "warning");
        return;
    }

    if (category === "minecraft") {
        payload.mcName = document.getElementById("sup-mc-name")?.value.trim() || "";
        payload.platform = document.getElementById("sup-platform")?.value || "";
    }

    if (category === "discord") {
        payload.discordName = document.getElementById("sup-discord-name")?.value.trim() || "";
    }

    setButtonLoading(button, true, "Sende Nachricht...");
    renderStatus(statusBox, "Nachricht wird verschickt...", "info");

    try {
        await db.collection("messages").add(payload);
        form.reset();
        window.toggleSupportFields();
        renderStatus(statusBox, "Deine Nachricht wurde erfolgreich gesendet.", "success");
        showGlobalStatus("Support-Anfrage gesendet.", "success");
    } catch (error) {
        renderStatus(statusBox, `Senden fehlgeschlagen: ${error.message}`, "error");
    } finally {
        setButtonLoading(button, false);
    }
};

function renderTicketCard(message, id) {
    const categoryMeta = CATEGORY_META[message.category] || CATEGORY_META.allgemein;
    const sentAt = message.timestamp ? new Date(message.timestamp.toDate()).toLocaleString("de-DE") : "Gerade eben";
    const replyAction = message.email && message.email.includes("@")
        ? `<a class="btn btn-primary" href="mailto:${escapeHtml(message.email)}">Per Mail antworten</a>`
        : `<span class="pill">Kontakt über Discord oder manuell</span>`;

    const extra = message.category === "minecraft"
        ? `<div class="ticket-note"><strong>Minecraft</strong><p>IGN: ${escapeHtml(message.mcName || "-")}<br>Plattform: ${escapeHtml(message.platform || "-")}</p></div>`
        : message.category === "discord"
            ? `<div class="ticket-note"><strong>Discord</strong><p>Name: ${escapeHtml(message.discordName || "-")}</p></div>`
            : "";

    return `
        <article class="admin-card" style="--accent:${categoryMeta.color}">
            <div class="card-top">
                <div>
                    <span class="card-badge" style="background:${categoryMeta.color}; color:#06110d;">${escapeHtml(categoryMeta.label)}</span>
                    <h3>${escapeHtml(message.name || "Unbekannt")}</h3>
                    <p>Gesendet am ${escapeHtml(sentAt)}</p>
                </div>
            </div>
            <div class="ticket-meta">
                <span class="pill">Kontakt: ${escapeHtml(message.email || "Nicht angegeben")}</span>
            </div>
            <div class="ticket-body">
                <p>${escapeHtml(message.message || "").replace(/\n/g, "<br>")}</p>
            </div>
            ${extra}
            <div class="card-actions">
                ${replyAction}
                <button class="btn btn-danger" onclick="deleteDoc('messages', '${id}')">Ticket löschen</button>
            </div>
        </article>
    `;
}

function renderAdminMessages() {
    const list = document.getElementById("admin-messages");
    if (!list) return;

    list.innerHTML = createEmptyState("Lade Tickets...", "Die Support-Anfragen werden vorbereitet.");

    db.collection("messages").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        const cards = [];
        snapshot.forEach((doc) => cards.push(renderTicketCard(doc.data(), doc.id)));
        list.innerHTML = cards.length
            ? `<div class="ticket-grid">${cards.join("")}</div>`
            : createEmptyState("Keine offenen Support-Tickets", "Neue Anfragen erscheinen automatisch hier.");
    }, () => {
        list.innerHTML = createEmptyState("Tickets konnten nicht geladen werden", "Bitte prüfe deine Verbindung und versuche es erneut.");
    });
}

function initProfilePage(user) {
    const emailEl = document.getElementById("profile-email");
    const roleEl = document.getElementById("profile-role");
    const nameField = document.getElementById("profile-name");
    const emailCard = document.getElementById("profile-email-card");
    const roleCard = document.getElementById("profile-role-card");

    if (!user || !nameField) return;

    if (emailEl) emailEl.textContent = user.email;
    if (emailCard) emailCard.textContent = user.email;
    if ((user.email || "").trim().toLowerCase() === (CONFIG.adminEmail || "").trim().toLowerCase()) {
        if (roleEl) {
            roleEl.textContent = "Administrator";
            roleEl.style.color = "#ffbd5c";
        }
        if (roleCard) roleCard.textContent = "Administrator";
    } else {
        if (roleEl) {
            roleEl.textContent = "Community-Mitglied";
            roleEl.style.color = "#7ee787";
        }
        if (roleCard) roleCard.textContent = "Community-Mitglied";
    }

    db.collection("users").doc(user.uid).get().then((doc) => {
        if (doc.exists && doc.data().displayName) {
            nameField.value = doc.data().displayName;
        } else {
            nameField.value = user.email.split("@")[0];
        }
    });
}

window.updateProfile = async function updateProfile(event) {
    event.preventDefault();
    const user = auth.currentUser;
    const nameField = document.getElementById("profile-name");
    const statusBox = getFormStatus("profile-form");
    const button = event.target.querySelector("button[type='submit']");

    if (!user || !nameField) {
        renderStatus(statusBox, "Du musst eingeloggt sein, um dein Profil zu bearbeiten.", "warning");
        return;
    }

    const displayName = nameField.value.trim();
    if (!displayName) {
        renderStatus(statusBox, "Bitte gib einen Anzeigenamen ein.", "warning");
        return;
    }

    setButtonLoading(button, true, "Speichere...");
        renderStatus(statusBox, "Profil wird gespeichert...", "info");

    try {
        await db.collection("users").doc(user.uid).set({ displayName }, { merge: true });
        renderStatus(statusBox, "Dein Profil wurde erfolgreich aktualisiert.", "success");
        showGlobalStatus("Profil aktualisiert.", "success");
    } catch (error) {
        renderStatus(statusBox, `Speichern fehlgeschlagen: ${error.message}`, "error");
    } finally {
        setButtonLoading(button, false);
    }
};

function updateAuthUi(user) {
    const adminNavLink = document.getElementById("admin-nav-link");
    const loginButtons = document.querySelectorAll(".user-login-btn");
    const guestFields = document.querySelectorAll(".guest-contact");
    const loginStatus = getFormStatus("login-form");
    const path = window.location.pathname;

    if (user) {
        const userEmail = user.email ? user.email.trim().toLowerCase() : "";
        const adminEmail = CONFIG.adminEmail ? CONFIG.adminEmail.trim().toLowerCase() : "";
        isAdmin = userEmail === adminEmail && userEmail !== "";

        guestFields.forEach((field) => {
            field.style.display = "none";
            field.required = false;
        });

        db.collection("users").doc(user.uid).onSnapshot((doc) => {
            const displayName = doc.exists && doc.data().displayName ? doc.data().displayName : user.email.split("@")[0];
            loginButtons.forEach((button) => {
                button.textContent = `Profil: ${displayName}`;
                button.onclick = () => {
                    window.location.href = "profil.html";
                };
            });
        });

        if (adminNavLink) adminNavLink.style.display = isAdmin ? "inline-flex" : "none";
        if (path.includes("admin.html")) {
            if (isAdmin) {
                renderAdminMessages();
            } else {
        showGlobalStatus("Dieser Bereich ist nur für Administratoren sichtbar.", "warning");
                window.location.replace("start.html");
            }
        }

        initProfilePage(user);
        renderStatus(loginStatus, "");
    } else {
        isAdmin = false;
        loginButtons.forEach((button) => {
            button.textContent = "Login";
            button.onclick = window.openLoginModal;
        });
        if (adminNavLink) adminNavLink.style.display = "none";
        guestFields.forEach((field) => {
            field.style.display = "block";
            field.required = true;
        });

        if (path.includes("profil.html") || path.includes("admin.html")) {
            window.location.replace("start.html");
        }
    }

    if (document.getElementById("news-list") || document.getElementById("fillypath-news-list")) {
        loadNews();
    }
}

function initBackground() {
    const canvas = document.getElementById("bgCanvas");
    if (!canvas) return;
    if (prefersReducedMotion) {
        canvas.remove();
        return;
    }
    const context = canvas.getContext("2d");
    const particles = [];

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function buildParticles() {
        particles.length = 0;
        const particleCount = window.innerWidth < 720 ? 28 : 48;
        for (let index = 0; index < particleCount; index += 1) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 0.6 + 0.2
            });
        }
    }

    function draw() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((particle) => {
            particle.y -= particle.speed;
            if (particle.y < -10) {
                particle.y = canvas.height + 10;
                particle.x = Math.random() * canvas.width;
            }
            context.fillStyle = "rgba(126, 231, 135, 0.28)";
            context.fillRect(particle.x, particle.y, particle.size, particle.size);
        });
        window.requestAnimationFrame(draw);
    }

    resizeCanvas();
    buildParticles();
    draw();
    window.addEventListener("resize", () => {
        resizeCanvas();
        buildParticles();
    });
}

window.copyServerIp = async function copyServerIp() {
    const value = document.getElementById("text-ip")?.textContent?.trim();
    if (!value) return;
    try {
        await navigator.clipboard.writeText(value);
        showGlobalStatus("Server-IP wurde in die Zwischenablage kopiert.", "success");
    } catch (error) {
        showGlobalStatus("Kopieren nicht möglich. Bitte markiere die IP manuell.", "warning");
    }
};

window.scrollToSection = function scrollToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.location.hash !== `#${id}`) {
        window.history.replaceState(null, "", `#${id}`);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    applyLinks();
    initBackground();
    siteSettings = normalizeSiteSettings({});
    watchSiteSettings();
    window.toggleSupportFields();
});

auth.onAuthStateChanged((user) => {
    updateAuthUi(user);
});
