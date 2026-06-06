import {
    collection,
    doc,
    getDocs,
    increment,
    orderBy,
    query,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

const THEMES = {
    Mechanics: ['measurement', 'kinematics', 'dynamics', 'forces', 'turning-effect-of-forces', 'pressure', 'energy-work-power', 'motion-in-a-circle', 'gravitational-field'],
    Thermodynamics: ['thermal-physics', 'kinetic-model-of-matter'],
    'Waves & Optics': ['oscillations', 'waves', 'superposition', 'light', 'electromagnetic-spectrum', 'sound'],
    'Electricity & Magnetism': ['electric-fields', 'electricity', 'magnetism', 'electromagnetism', 'electromagnetic-induction', 'alternating-current'],
    'Modern Physics': ['nuclear-physics', 'quantum-physics'],
    General: ['general', 'graphing-technique']
};

window.simulationsData = [];
window.simulationStats = {};

const LIKED_SIMULATIONS_KEY = 'physicsLensLikedSimulations';

function normalizeTopicId(topic) {
    return String(topic || '').trim().toLowerCase().replace(/[,\s]+/g, '-');
}

function formatTopicLabel(topic) {
    return String(topic || '')
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function getVisibleSimulations(simulations) {
    const isJavaScriptPage = window.location.pathname.includes('javascript.html');
    return simulations.filter(sim => !isJavaScriptPage || sim.platform === 'JavaScript');
}

document.addEventListener('DOMContentLoaded', async function() {
    initializeMobileMenu();
    initializeSearch();
    await loadSimulations();
});

async function loadSimulations() {
    const navContainer = document.getElementById('navigation');
    const container = document.getElementById('simulations-container');
    if (!navContainer || !container) {
        console.error('Required DOM elements not found');
        return;
    }

    try {
        const simulationsRef = collection(db, 'simulations');
        const [snapshot, statsSnapshot] = await Promise.all([
            getDocs(query(simulationsRef, orderBy('sortOrder', 'asc'))),
            loadSimulationStats()
        ]);

        const simulations = snapshot.docs.map(doc => normalizeSimulation(doc));
        window.simulationStats = statsSnapshot;
        window.simulationsData = simulations;
        processSimulations(simulations);
    } catch (error) {
        console.error('Error loading Firestore simulations:', error);
        navContainer.className = 'nav-menu';
        navContainer.innerHTML = '<li class="nav-item"><button class="nav-button" type="button">Load Error</button></li>';
        container.innerHTML = '<div class="no-results"><h2>Unable to load simulations</h2><p>Check Firestore configuration, rules, and network access.</p></div>';
    }
}

async function loadSimulationStats() {
    try {
        const snapshot = await getDocs(collection(db, 'simulationStats'));
        return snapshot.docs.reduce((stats, statsDoc) => {
            const data = statsDoc.data();
            stats[statsDoc.id] = {
                totalLaunches: Number(data.totalLaunches || 0),
                likes: Number(data.likes || 0)
            };
            return stats;
        }, {});
    } catch (error) {
        console.error('Error loading simulation stats:', error);
        return {};
    }
}

function normalizeSimulation(doc) {
    const data = doc.data();
    return {
        firestoreId: doc.id,
        id: (data.id || doc.id || '').trim(),
        title: (data.title || 'Untitled').trim(),
        description: (data.description || '').trim(),
        author: (data.author || '').trim(),
        image: (data.image || '').trim(),
        url: (data.url || '#').trim(),
        platform: (data.platform || 'Unknown').trim(),
        topics: Array.isArray(data.topics)
            ? data.topics.map(topic => String(topic).trim()).filter(Boolean)
            : [],
        sortOrder: Number.isFinite(data.sortOrder) ? data.sortOrder : Number.MAX_SAFE_INTEGER
    };
}

function processSimulations(simulations) {
    const container = document.getElementById('simulations-container');
    const navContainer = document.getElementById('navigation');
    if (!container || !navContainer) return;
    container.innerHTML = '';

    const topicsMap = new Map();
    const seenTopics = new Set();
    const orderedTopics = [];
    const topics = {};

    getVisibleSimulations(simulations).forEach(sim => {
        const addedToTopics = new Set();
        sim.topics.forEach(rawTopic => {
            const id = normalizeTopicId(rawTopic);
            if (!topics[id]) topics[id] = [];
            if (!addedToTopics.has(id)) {
                topics[id].push(sim);
                addedToTopics.add(id);
            }
            if (!seenTopics.has(id)) {
                const displayText = formatTopicLabel(rawTopic);
                topicsMap.set(id, displayText);
                seenTopics.add(id);
                orderedTopics.push([id, displayText]);
            }
        });
    });

    // Build a single grouped topic dropdown for reliable navigation.
    let optionGroupsHTML = '<option value="">Jump to a topic...</option>';
    const availableTopicIds = new Set(orderedTopics.map(([id]) => id));
    Object.entries(THEMES).forEach(([themeName, themeTopics]) => {
        const availableTopics = themeTopics.filter(topicId => availableTopicIds.has(topicId));
        if (availableTopics.length > 0) {
            optionGroupsHTML += `<optgroup label="${themeName}">`;
            optionGroupsHTML += `<option value="category:${themeName}">All ${themeName}</option>`;
            availableTopics.forEach(topicId => {
                optionGroupsHTML += `<option value="${topicId}">${topicsMap.get(topicId)}</option>`;
            });
            optionGroupsHTML += '</optgroup>';
        }
    });

    const categorizedTopics = new Set(Object.values(THEMES).flat());
    const otherTopics = orderedTopics.filter(([id]) => !categorizedTopics.has(id));
    if (otherTopics.length > 0) {
        optionGroupsHTML += '<optgroup label="Other Topics">';
        optionGroupsHTML += '<option value="category:Other Topics">All Other Topics</option>';
        otherTopics.forEach(([id, display]) => {
            optionGroupsHTML += `<option value="${id}">${display}</option>`;
        });
        optionGroupsHTML += '</optgroup>';
    }

    navContainer.className = 'nav-menu nav-topic-menu';
    navContainer.innerHTML = `
        <li class="nav-item nav-topic-picker">
            <label for="topic-dropdown" class="topic-dropdown-label">Browse Topics</label>
            <select id="topic-dropdown" class="topic-dropdown">${optionGroupsHTML}</select>
        </li>
    `;
    setupNavigationHandlers();

    // Render all topic sections as before
    orderedTopics.forEach(([id]) => {
        if (topics[id]) {
            const section = document.createElement('section');
            section.id = id;
            section.innerHTML = `<h2>${topicsMap.get(id)}</h2><div class="simulation-grid"></div>`;
            const grid = section.querySelector('.simulation-grid');
            topics[id].forEach(sim => grid.appendChild(createSimulationCard(sim)));
            container.appendChild(section);
        }
    });
}

function createSimulationCard(sim) {
    const card = document.createElement('div');
    card.className = 'simulation-card';
    card.dataset.simId = sim.id;

    const imageUrl = sim.image || 'images/placeholder.svg';
    const stats = getSimulationStats(sim.id);
    const liked = isSimulationLiked(sim.id);

    card.innerHTML = `
        <div class="card-image">
            <img src="${imageUrl}" alt="${sim.title}" onerror="this.src='images/placeholder.svg'">
        </div>
        <div class="card-content">
            <h3>${sim.title}</h3>
            ${sim.author ? `<div class="author-info">by ${sim.author}</div>` : ''}
            <p class="description">${sim.description}</p>
            <div class="card-stats" aria-live="polite">
                <span class="stat-item"><span class="stat-count" data-stat="launches">${formatCount(stats.totalLaunches)}</span> launches</span>
                <span class="stat-item"><span class="stat-count" data-stat="likes">${formatCount(stats.likes)}</span> likes</span>
            </div>
            <div class="card-footer">
                <span class="platform">${sim.platform}</span>
                <div class="card-actions">
                    <button type="button" class="like-button${liked ? ' liked' : ''}" data-action="like" ${liked ? 'disabled' : ''}>${liked ? 'Liked' : 'Like'}</button>
                    <a href="${sim.url}" target="_blank" class="button launch-button" data-action="launch" rel="noopener">Launch</a>
                </div>
            </div>
        </div>
    `;

    const launchLink = card.querySelector('[data-action="launch"]');
    const likeButton = card.querySelector('[data-action="like"]');

    launchLink?.addEventListener('click', () => {
        recordSimulationLaunch(sim.id);
    });

    likeButton?.addEventListener('click', () => {
        recordSimulationLike(sim.id, likeButton, card);
    });

    return card;
}

function getSimulationStats(simId) {
    return window.simulationStats?.[simId] || { totalLaunches: 0, likes: 0 };
}

function formatCount(value) {
    return Number(value || 0).toLocaleString();
}

function getLikedSimulationIds() {
    try {
        const parsed = JSON.parse(localStorage.getItem(LIKED_SIMULATIONS_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function isSimulationLiked(simId) {
    return getLikedSimulationIds().includes(simId);
}

function saveSimulationLiked(simId) {
    const likedIds = new Set(getLikedSimulationIds());
    likedIds.add(simId);
    localStorage.setItem(LIKED_SIMULATIONS_KEY, JSON.stringify(Array.from(likedIds)));
}

async function recordSimulationLaunch(simId) {
    incrementLocalStat(simId, 'totalLaunches');
    try {
        await setDoc(doc(db, 'simulationStats', simId), {
            totalLaunches: increment(1),
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error recording launch:', error);
    }
}

async function recordSimulationLike(simId, button, card) {
    if (isSimulationLiked(simId)) {
        return;
    }

    saveSimulationLiked(simId);
    updateAllLikeButtons(simId);
    incrementLocalStat(simId, 'likes');
    updateCardStat(card, 'likes', getSimulationStats(simId).likes);

    try {
        await setDoc(doc(db, 'simulationStats', simId), {
            likes: increment(1),
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error recording like:', error);
    }
}

function updateAllLikeButtons(simId) {
    document.querySelectorAll(`.simulation-card[data-sim-id="${CSS.escape(simId)}"] [data-action="like"]`).forEach(button => {
        button.textContent = 'Liked';
        button.classList.add('liked');
        button.disabled = true;
    });
}

function incrementLocalStat(simId, fieldName) {
    const stats = getSimulationStats(simId);
    window.simulationStats[simId] = {
        ...stats,
        [fieldName]: Number(stats[fieldName] || 0) + 1
    };
    updateAllCardStats(simId, fieldName, window.simulationStats[simId][fieldName]);
}

function updateAllCardStats(simId, fieldName, value) {
    document.querySelectorAll(`.simulation-card[data-sim-id="${CSS.escape(simId)}"]`).forEach(card => {
        updateCardStat(card, fieldName, value);
    });
}

function updateCardStat(card, fieldName, value) {
    const statName = fieldName === 'totalLaunches' ? 'launches' : 'likes';
    const statElement = card?.querySelector(`[data-stat="${statName}"]`);
    if (statElement) {
        statElement.textContent = formatCount(value);
    }
}

function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');

    if (!searchInput || !searchButton) {
        return;
    }

    searchButton.addEventListener('click', function() {
        const query = searchInput.value.trim();
        if (query) {
            resetTopicFilter();
            performSearch(query);
        }
    });

    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                resetTopicFilter();
                performSearch(query);
            }
        }
    });
}

function resetTopicFilter() {
    const dropdown = document.getElementById('topic-dropdown');
    if (dropdown) {
        dropdown.value = '';
    }
}

function performSearch(queryText) {
    const simulations = getVisibleSimulations(window.simulationsData || []);
    const container = document.getElementById('simulations-container');

    if (!container) {
        return;
    }

    container.innerHTML = '';

    const queryLower = queryText.toLowerCase();
    const matchingSimulations = simulations.filter(sim => {
        return sim.title.toLowerCase().includes(queryLower)
            || sim.description.toLowerCase().includes(queryLower)
            || sim.topics.some(topic => topic.toLowerCase().includes(queryLower));
    });

    if (matchingSimulations.length === 0) {
        container.innerHTML = `<div class="no-results"><h2>No results found for "${queryText}"</h2><p>Try different keywords or browse by category.</p></div>`;
        return;
    }

    const section = document.createElement('section');
    section.innerHTML = `<h2>Search Results for "${queryText}" (${matchingSimulations.length} found)</h2><div class="simulation-grid"></div>`;

    const grid = section.querySelector('.simulation-grid');
    matchingSimulations.forEach(sim => grid.appendChild(createSimulationCard(sim)));
    container.appendChild(section);
}

function setupNavigationHandlers() {
    const dropdown = document.getElementById('topic-dropdown');
    if (!dropdown) {
        return;
    }

    dropdown.onchange = function() {
        const topicId = dropdown.value;
        const searchInput = document.getElementById('search-input');

        // Applying a topic filter clears search.
        if (searchInput) {
            searchInput.value = '';
        }

        if (!topicId) {
            processSimulations(window.simulationsData || []);
            return;
        }

        const selectedOption = dropdown.options[dropdown.selectedIndex];
        const topicName = selectedOption?.text || topicId;

        if (topicId.startsWith('category:')) {
            filterByCategory(topicId.replace('category:', ''), topicName);
        } else {
            filterByTopic(topicId, topicName);
        }

        const hamburgerMenu = document.getElementById('hamburger-menu');
        const mainNav = document.getElementById('main-nav');
        if (window.innerWidth <= 768 && hamburgerMenu && mainNav) {
            hamburgerMenu.classList.remove('active');
            mainNav.classList.remove('active');
            hamburgerMenu.setAttribute('aria-expanded', 'false');
        }
    };
}

function filterByTopic(topicId, topicName) {
    const simulations = getVisibleSimulations(window.simulationsData || []);
    const container = document.getElementById('simulations-container');

    if (!container) {
        return;
    }

    container.innerHTML = '';
    const matchingSimulations = simulations.filter(sim =>
        sim.topics.some(topic => normalizeTopicId(topic) === topicId)
    );

    if (matchingSimulations.length === 0) {
        container.innerHTML = `<div class="no-results"><h2>No simulations found for "${topicName}"</h2><p>Try browsing other categories.</p></div>`;
        return;
    }

    const section = document.createElement('section');
    section.innerHTML = `<h2>${topicName} (${matchingSimulations.length} simulations)</h2><div class="simulation-grid"></div>`;

    const grid = section.querySelector('.simulation-grid');
    matchingSimulations.forEach(sim => grid.appendChild(createSimulationCard(sim)));
    container.appendChild(section);
}

function filterByCategory(categoryName, categoryLabel) {
    const simulations = getVisibleSimulations(window.simulationsData || []);
    const container = document.getElementById('simulations-container');

    if (!container) {
        return;
    }

    const categoryTopics = categoryName === 'Other Topics'
        ? getOtherTopicIds(simulations)
        : THEMES[categoryName] || [];
    const topicSet = new Set(categoryTopics);
    const matchingSimulations = simulations.filter(sim =>
        sim.topics.some(topic => topicSet.has(normalizeTopicId(topic)))
    );

    container.innerHTML = '';

    if (matchingSimulations.length === 0) {
        container.innerHTML = `<div class="no-results"><h2>No simulations found for "${categoryLabel}"</h2><p>Try browsing other categories.</p></div>`;
        return;
    }

    const section = document.createElement('section');
    section.innerHTML = `<h2>${categoryLabel} (${matchingSimulations.length} simulations)</h2><div class="simulation-grid"></div>`;

    const grid = section.querySelector('.simulation-grid');
    matchingSimulations.forEach(sim => grid.appendChild(createSimulationCard(sim)));
    container.appendChild(section);
}

function getOtherTopicIds(simulations) {
    const categorizedTopics = new Set(Object.values(THEMES).flat());
    const topicIds = new Set();

    simulations.forEach(sim => {
        sim.topics.forEach(topic => {
            const topicId = normalizeTopicId(topic);
            if (!categorizedTopics.has(topicId)) {
                topicIds.add(topicId);
            }
        });
    });

    return Array.from(topicIds);
}

function initializeMobileMenu() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const mainNav = document.getElementById('main-nav');

    if (!hamburgerMenu || !mainNav) {
        return;
    }

    function closeMobileMenu() {
        hamburgerMenu.classList.remove('active');
        mainNav.classList.remove('active');
        hamburgerMenu.setAttribute('aria-expanded', 'false');
    }

    hamburgerMenu.addEventListener('click', function() {
        hamburgerMenu.classList.toggle('active');
        mainNav.classList.toggle('active');
        const isExpanded = mainNav.classList.contains('active');
        hamburgerMenu.setAttribute('aria-expanded', isExpanded);
    });

    document.addEventListener('click', function(event) {
        if (!hamburgerMenu.contains(event.target) && !mainNav.contains(event.target)) {
            closeMobileMenu();
        }
    });

    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && mainNav.classList.contains('active')) {
            closeMobileMenu();
        }
    });
}
