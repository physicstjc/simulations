import {
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
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth, db } from "./firebase-config.js";

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
    elements.loginForm = document.getElementById('login-form');
    elements.registerButton = document.getElementById('register-button');
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
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.registerButton.addEventListener('click', handleRegister);
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

async function handleLogin(event) {
    event.preventDefault();

    const email = elements.loginForm.email.value.trim();
    const password = elements.loginForm.password.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        elements.loginForm.reset();
        setStatus(elements.authStatus, 'Signed in successfully.', 'success');
    } catch (error) {
        setStatus(elements.authStatus, error.message, 'error');
    }
}

async function handleRegister() {
    const email = elements.loginForm.email.value.trim();
    const password = elements.loginForm.password.value;

    if (!email || !password) {
        setStatus(elements.authStatus, 'Enter email and password before creating an account.', 'error');
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        setStatus(elements.authStatus, 'Admin account created and signed in.', 'success');
    } catch (error) {
        setStatus(elements.authStatus, error.message, 'error');
    }
}

async function handleLogout() {
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

            try {
                await deleteDoc(doc(db, 'simulations', simulation.firestoreId));
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
    const confirmed = window.confirm('Import all records from data/simulations.xml into Firestore? Existing documents with the same IDs will be overwritten.');
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`data/simulations.xml?v=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const xmlText = await response.text();
        const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml');
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('XML parsing failed.');
        }

        const simulationNodes = Array.from(xmlDoc.querySelectorAll('simulation'));
        let importedCount = 0;

        for (const [index, node] of simulationNodes.entries()) {
            const id = (node.querySelector('id')?.textContent || '').trim();
            if (!id) {
                continue;
            }

            const payload = {
                id,
                title: (node.querySelector('title')?.textContent || 'Untitled').trim(),
                description: (node.querySelector('description')?.textContent || '').trim(),
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

        setStatus(elements.cmsStatus, `Imported ${importedCount} simulations from XML into Firestore.`, 'success');
        await loadSimulations();
    } catch (error) {
        setStatus(elements.cmsStatus, `Import failed: ${error.message}`, 'error');
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
