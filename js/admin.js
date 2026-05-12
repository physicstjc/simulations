import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth, db } from "./firebase-config.js";

const ALLOWED_EMAIL = 'wboson2007@gmail.com';
const ALLOWED_DOMAIN = '@moe.edu.sg';

const state = {
    simulations: [],
    filteredSimulations: [],
    editingId: null
};

const elements = {};

document.addEventListener('DOMContentLoaded', function() {
    cacheDom();
    bindEvents();
    resetForm();
    attachAuthListener();
});

function cacheDom() {
    elements.authPanel = document.getElementById('auth-panel');
    elements.cmsPanel = document.getElementById('cms-panel');
    elements.googleLoginButton = document.getElementById('google-login-button');
    elements.logoutButton = document.getElementById('logout-button');
    elements.authStatus = document.getElementById('auth-status');
    elements.cmsStatus = document.getElementById('cms-status');
    elements.form = document.getElementById('simulation-form');
    elements.resetFormButton = document.getElementById('reset-form-button');
    elements.newSimulationButton = document.getElementById('new-simulation-button');
    elements.importXmlButton = document.getElementById('import-xml-button');
    elements.list = document.getElementById('simulations-list');
    elements.editorHeading = document.getElementById('editor-heading');
    elements.searchInput = document.getElementById('admin-search');
    elements.searchButton = document.getElementById('admin-search-button');
    elements.idInput = document.getElementById('simulation-id');
    elements.sortOrderInput = document.getElementById('sort-order');
    elements.titleInput = document.getElementById('title');
    elements.descriptionInput = document.getElementById('description');
    elements.imageInput = document.getElementById('image');
    elements.urlInput = document.getElementById('url');
    elements.platformInput = document.getElementById('platform');
    elements.authorInput = document.getElementById('author');
    elements.topicsInput = document.getElementById('topics');
}

function bindEvents() {
    elements.googleLoginButton.addEventListener('click', handleGoogleLogin);
    elements.logoutButton.addEventListener('click', handleLogout);
    elements.form.addEventListener('submit', handleSaveSimulation);
    elements.resetFormButton.addEventListener('click', resetForm);
    elements.newSimulationButton.addEventListener('click', resetForm);
    elements.importXmlButton.addEventListener('click', importFromXml);
    elements.searchButton.addEventListener('click', filterSimulations);
    elements.searchInput.addEventListener('input', filterSimulations);
}

function attachAuthListener() {
    onAuthStateChanged(auth, async user => {
        if (user) {
            if (!isAuthorizedUser(user)) {
                await recordAudit('auth_denied', {
                    reason: 'Email not in allowlist',
                    attemptedEmail: user.email || null
                });
                await signOut(auth);
                setStatus(elements.authStatus, 'Access denied. Only wboson2007@gmail.com and @moe.edu.sg accounts can access CMS.', 'error');
                return;
            }

            elements.authPanel.classList.add('hidden-panel');
            elements.cmsPanel.classList.remove('hidden-panel');
            setStatus(elements.cmsStatus, `Signed in as ${user.email}`, 'success');
            await loadSimulations();
        } else {
            elements.authPanel.classList.remove('hidden-panel');
            elements.cmsPanel.classList.add('hidden-panel');
            state.simulations = [];
            state.filteredSimulations = [];
            renderSimulations();
        }
    });
}

async function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        const result = await signInWithPopup(auth, provider);
        if (!isAuthorizedUser(result.user)) {
            await recordAudit('auth_denied', {
                reason: 'Email not in allowlist',
                attemptedEmail: result.user.email || null
            });
            await signOut(auth);
            setStatus(elements.authStatus, 'Access denied. Only wboson2007@gmail.com and @moe.edu.sg accounts can access CMS.', 'error');
            return;
        }

        await recordAudit('auth_login', {
            email: result.user.email || null,
            method: 'google'
        });
        setStatus(elements.authStatus, 'Signed in successfully.', 'success');
    } catch (error) {
        setStatus(elements.authStatus, error.message, 'error');
    }
}

async function handleLogout() {
    await recordAudit('auth_logout', {
        email: auth.currentUser?.email || null
    });
    await signOut(auth);
}

async function loadSimulations() {
    try {
        const simulationsRef = collection(db, 'simulations');
        const snapshot = await getDocs(query(simulationsRef, orderBy('sortOrder', 'asc')));
        state.simulations = snapshot.docs.map(simulationDoc => ({
            firestoreId: simulationDoc.id,
            ...simulationDoc.data()
        }));
        state.filteredSimulations = [...state.simulations];
        renderSimulations();
    } catch (error) {
        setStatus(elements.cmsStatus, `Failed to load simulations: ${error.message}`, 'error');
    }
}

async function handleSaveSimulation(event) {
    event.preventDefault();

    if (!requireAuthorizedAccess()) {
        return;
    }

    const formData = new FormData(elements.form);
    const id = String(formData.get('id') || '').trim();

    if (!id) {
        setStatus(elements.cmsStatus, 'Simulation ID is required.', 'error');
        return;
    }

    const payload = {
        id,
        title: String(formData.get('title') || '').trim(),
        description: String(formData.get('description') || '').trim(),
        image: String(formData.get('image') || '').trim(),
        url: String(formData.get('url') || '').trim(),
        platform: String(formData.get('platform') || 'JavaScript').trim(),
        author: String(formData.get('author') || '').trim(),
        topics: String(formData.get('topics') || '')
            .split(',')
            .map(topic => topic.trim().toLowerCase())
            .filter(Boolean),
        sortOrder: parseSortOrder(formData.get('sortOrder'), state.simulations.length + 1),
        updatedAt: serverTimestamp()
    };

    if (!payload.title || !payload.url) {
        setStatus(elements.cmsStatus, 'Title and Launch URL are required.', 'error');
        return;
    }

    try {
        const existing = state.simulations.find(sim => sim.firestoreId === id);
        await setDoc(doc(db, 'simulations', id), {
            ...existing,
            ...payload,
            createdAt: existing?.createdAt || serverTimestamp()
        }, { merge: true });
        await recordAudit(state.editingId ? 'update_simulation' : 'create_simulation', {
            simulationId: id,
            title: payload.title
        });
        setStatus(elements.cmsStatus, state.editingId ? `Updated ${payload.title}.` : `Created ${payload.title}.`, 'success');
        resetForm();
        await loadSimulations();
    } catch (error) {
        setStatus(elements.cmsStatus, `Failed to save simulation: ${error.message}`, 'error');
    }
}

function parseSortOrder(value, fallback) {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function renderSimulations() {
    if (!elements.list) {
        return;
    }

    if (state.filteredSimulations.length === 0) {
        elements.list.innerHTML = '<div class="empty-state">No matching simulations.</div>';
        return;
    }

    elements.list.innerHTML = state.filteredSimulations.map(sim => `
        <article class="simulation-row" data-id="${escapeHtml(sim.firestoreId)}">
            <img src="${escapeAttribute(sim.image || 'images/placeholder.svg')}" alt="${escapeAttribute(sim.title || 'Simulation')}" onerror="this.src='images/placeholder.svg'">
            <div>
                <h3>${escapeHtml(sim.title || 'Untitled')}</h3>
                <p class="simulation-meta">${escapeHtml(sim.id || sim.firestoreId)} · ${escapeHtml(sim.platform || 'Unknown')} · ${escapeHtml(sim.author || 'No author')}</p>
                <p>${escapeHtml(sim.description || 'No description')}</p>
                <p class="simulation-meta">Topics: ${escapeHtml((sim.topics || []).join(', ') || 'None')}</p>
            </div>
            <div class="simulation-actions">
                <button type="button" class="admin-button secondary" data-action="edit" data-id="${escapeAttribute(sim.firestoreId)}">Edit</button>
                <button type="button" class="admin-button danger" data-action="delete" data-id="${escapeAttribute(sim.firestoreId)}">Delete</button>
            </div>
        </article>
    `).join('');

    elements.list.querySelectorAll('[data-action="edit"]').forEach(button => {
        button.addEventListener('click', function() {
            const simulation = state.simulations.find(item => item.firestoreId === button.dataset.id);
            if (simulation) {
                populateForm(simulation);
            }
        });
    });

    elements.list.querySelectorAll('[data-action="delete"]').forEach(button => {
        button.addEventListener('click', async function() {
            const simulation = state.simulations.find(item => item.firestoreId === button.dataset.id);
            if (!simulation) {
                return;
            }

            const confirmed = window.confirm(`Delete ${simulation.title}? This cannot be undone.`);
            if (!confirmed) {
                return;
            }

            if (!requireAuthorizedAccess()) {
                return;
            }

            try {
                await deleteDoc(doc(db, 'simulations', simulation.firestoreId));
                await recordAudit('delete_simulation', {
                    simulationId: simulation.firestoreId,
                    title: simulation.title || null
                });
                setStatus(elements.cmsStatus, `Deleted ${simulation.title}.`, 'success');
                if (state.editingId === simulation.firestoreId) {
                    resetForm();
                }
                await loadSimulations();
            } catch (error) {
                setStatus(elements.cmsStatus, `Failed to delete simulation: ${error.message}`, 'error');
            }
        });
    });
}

function populateForm(simulation) {
    state.editingId = simulation.firestoreId;
    elements.editorHeading.textContent = `Edit ${simulation.title}`;
    elements.idInput.value = simulation.id || simulation.firestoreId;
    elements.sortOrderInput.value = simulation.sortOrder ?? '';
    elements.titleInput.value = simulation.title || '';
    elements.descriptionInput.value = simulation.description || '';
    elements.imageInput.value = simulation.image || '';
    elements.urlInput.value = simulation.url || '';
    elements.platformInput.value = simulation.platform || 'JavaScript';
    elements.authorInput.value = simulation.author || '';
    elements.topicsInput.value = Array.isArray(simulation.topics) ? simulation.topics.join(', ') : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    state.editingId = null;
    elements.editorHeading.textContent = 'Create Simulation';
    elements.form.reset();
    elements.authorInput.value = 'Tan Seng Kwang';
    elements.platformInput.value = 'JavaScript';
}

function filterSimulations() {
    const queryText = elements.searchInput.value.trim().toLowerCase();
    if (!queryText) {
        state.filteredSimulations = [...state.simulations];
        renderSimulations();
        return;
    }

    state.filteredSimulations = state.simulations.filter(sim => {
        const haystack = [
            sim.id,
            sim.title,
            sim.description,
            sim.author,
            sim.platform,
            ...(sim.topics || [])
        ].join(' ').toLowerCase();
        return haystack.includes(queryText);
    });
    renderSimulations();
}

async function importFromXml() {
    if (!requireAuthorizedAccess()) {
        return;
    }

    const confirmed = window.confirm('Import records from data/simulations.xml and data/simulations_backup.xml into Firestore? Existing IDs from simulations.xml take priority, and backup records fill missing historical entries.');
    if (!confirmed) {
        return;
    }

    try {
        const timestamp = Date.now();
        const [primaryNodes, backupNodes] = await Promise.all([
            loadSimulationNodes(`data/simulations.xml?v=${timestamp}`),
            loadSimulationNodes(`data/simulations_backup.xml?v=${timestamp}`)
        ]);

        const mergedById = new Map();

        for (const node of primaryNodes) {
            const id = (node.querySelector('id')?.textContent || '').trim();
            if (!id) {
                continue;
            }
            mergedById.set(id, node);
        }

        for (const node of backupNodes) {
            const id = (node.querySelector('id')?.textContent || '').trim();
            if (!id || mergedById.has(id)) {
                continue;
            }
            mergedById.set(id, node);
        }

        let importedCount = 0;
        const mergedNodes = Array.from(mergedById.values());

        for (const [index, node] of mergedNodes.entries()) {
            const id = (node.querySelector('id')?.textContent || '').trim();
            if (!id) {
                continue;
            }

            const payload = {
                id,
                title: (node.querySelector('title')?.textContent || 'Untitled').trim(),
                description: (node.querySelector('description')?.textContent || '').trim(),
                // Keep XML image URLs exactly as authored (including direct GeoGebra links).
                image: (node.querySelector('image')?.textContent || '').trim(),
                url: (node.querySelector('url')?.textContent || '#').trim(),
                platform: (node.querySelector('platform')?.textContent || 'Unknown').trim(),
                author: (node.querySelector('author')?.textContent || '').trim(),
                topics: Array.from(node.querySelectorAll('topic')).map(topicNode => topicNode.textContent.trim()).filter(Boolean),
                sortOrder: index + 1,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
            };

            await setDoc(doc(db, 'simulations', id), payload, { merge: true });
            importedCount += 1;
        }

        setStatus(elements.cmsStatus, `Imported ${importedCount} merged simulations from XML into Firestore.`, 'success');
        await recordAudit('import_xml', {
            importedCount,
            sourceFiles: ['data/simulations.xml', 'data/simulations_backup.xml']
        });
        await loadSimulations();
    } catch (error) {
        await recordAudit('import_xml_failed', {
            error: error.message
        });
        setStatus(elements.cmsStatus, `Import failed: ${error.message}`, 'error');
    }
}

async function loadSimulationNodes(xmlUrl) {
    const response = await fetch(xmlUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${xmlUrl} (HTTP ${response.status})`);
    }

    const xmlText = await response.text();
    const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        throw new Error(`XML parsing failed for ${xmlUrl}.`);
    }

    return Array.from(xmlDoc.querySelectorAll('simulation'));
}

function isAuthorizedEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    return normalized === ALLOWED_EMAIL || normalized.endsWith(ALLOWED_DOMAIN);
}

function isAuthorizedUser(user) {
    return isAuthorizedEmail(user?.email || '');
}

function requireAuthorizedAccess() {
    if (isAuthorizedUser(auth.currentUser)) {
        return true;
    }

    setStatus(elements.cmsStatus, 'Access denied. Only wboson2007@gmail.com and @moe.edu.sg accounts can edit.', 'error');
    return false;
}

async function recordAudit(action, details = {}) {
    try {
        await addDoc(collection(db, 'auditLogs'), {
            action,
            ...details,
            userEmail: auth.currentUser?.email || null,
            userUid: auth.currentUser?.uid || null,
            userAgent: navigator.userAgent,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Failed to write audit log:', error);
    }
}

function setStatus(container, message, type) {
    container.innerHTML = `<div class="result-message ${type}">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
    return escapeHtml(value);
}
