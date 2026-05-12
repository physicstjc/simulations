import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
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
        const snapshot = await getDocs(query(simulationsRef, orderBy('sortOrder', 'asc')));

        const simulations = snapshot.docs.map(doc => normalizeSimulation(doc));
        window.simulationsData = simulations;
        processSimulations(simulations);
    } catch (error) {
        console.error('Error loading Firestore simulations:', error);
        navContainer.className = 'nav-menu';
        navContainer.innerHTML = '<li class="nav-item"><button class="nav-button" type="button">Load Error</button></li>';
        container.innerHTML = '<div class="no-results"><h2>Unable to load simulations</h2><p>Check Firestore configuration, rules, and network access.</p></div>';
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

    if (!container || !navContainer) {
        return;
    }

    container.innerHTML = '';

    const isJavaScriptPage = window.location.pathname.includes('javascript.html');
    const topicsMap = new Map();
    const seenTopics = new Set();
    const orderedTopics = [];
    const topics = {};

    simulations.forEach(sim => {
        if (isJavaScriptPage && sim.platform !== 'JavaScript') {
            return;
        }

        const addedToTopics = new Set();

        sim.topics.forEach(rawTopic => {
            const id = rawTopic.toLowerCase().replace(/[,\s]+/g, '-');

            if (!topics[id]) {
                topics[id] = [];
            }

            if (!addedToTopics.has(id)) {
                topics[id].push(sim);
                addedToTopics.add(id);
            }

            if (!seenTopics.has(id)) {
                const displayText = rawTopic
                    .replace(/-/g, ' ')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                topicsMap.set(id, displayText);
                seenTopics.add(id);
                orderedTopics.push([id, displayText]);
            }
        });
    });

    let navHTML = '';
    Object.entries(THEMES).forEach(([themeName, themeTopics]) => {
        const availableTopics = themeTopics.filter(topicId => orderedTopics.some(([id]) => id === topicId));

        if (availableTopics.length > 0) {
            navHTML += `
                <li class="nav-item">
                    <button class="nav-button" data-theme="${themeName}">${themeName}</button>
                    <div class="dropdown-menu">
                        <ul class="dropdown-list">
                            ${availableTopics.map(topicId => {
                                const topicDisplay = topicsMap.get(topicId);
                                return `<li><button class="dropdown-link" data-topic="${topicDisplay}">${topicDisplay}</button></li>`;
                            }).join('')}
                        </ul>
                    </div>
                </li>
            `;
        }
    });

    const categorizedTopics = Object.values(THEMES).flat();
    const otherTopics = orderedTopics.filter(([id]) => !categorizedTopics.includes(id));

    if (otherTopics.length > 0) {
        navHTML += `
            <li class="nav-item">
                <button class="nav-button" data-theme="Other">Other Topics</button>
                <div class="dropdown-menu">
                    <ul class="dropdown-list">
                        ${otherTopics.map(([, topic]) => `<li><button class="dropdown-link" data-topic="${topic}">${topic}</button></li>`).join('')}
                    </ul>
                </div>
            </li>
        `;
    }

    navContainer.className = 'nav-menu';
    navContainer.innerHTML = navHTML;
    setupNavigationHandlers();

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

    const imageUrl = sim.image || 'images/placeholder.svg';

    card.innerHTML = `
        <div class="card-image">
            <img src="${imageUrl}" alt="${sim.title}" onerror="this.src='images/placeholder.svg'">
        </div>
        <div class="card-content">
            <h3>${sim.title}</h3>
            ${sim.author ? `<div class="author-info">by ${sim.author}</div>` : ''}
            <p class="description">${sim.description}</p>
            <div class="card-footer">
                <span class="platform">${sim.platform}</span>
                <a href="${sim.url}" target="_blank" class="button">Launch</a>
            </div>
        </div>
    `;

    return card;
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
            performSearch(query);
        }
    });

    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                performSearch(query);
            }
        }
    });
}

function performSearch(queryText) {
    const simulations = window.simulationsData || [];
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
    const dropdownLinks = document.querySelectorAll('.dropdown-link');

    dropdownLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const topic = this.getAttribute('data-topic');
            if (topic) {
                filterByTopic(topic);
            }
        });
    });
}

function filterByTopic(topicName) {
    const simulations = window.simulationsData || [];
    const container = document.getElementById('simulations-container');

    if (!container) {
        return;
    }

    container.innerHTML = '';
    const topicId = topicName.toLowerCase().replace(/\s+/g, '-');
    const matchingSimulations = simulations.filter(sim => sim.topics.some(topic => topic.toLowerCase() === topicId));

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

    mainNav.addEventListener('click', function(event) {
        if (event.target.classList.contains('dropdown-link') || event.target.closest('.dropdown-link')) {
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('dropdown-open'));
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
        }

        if (event.target.classList.contains('nav-button') || event.target.closest('.nav-button')) {
            const navItem = event.target.closest('.nav-item');
            if (navItem) {
                const isOpen = navItem.classList.contains('dropdown-open');
                const allNavItems = document.querySelectorAll('.nav-item');
                allNavItems.forEach(item => item.classList.remove('dropdown-open'));
                if (!isOpen) {
                    navItem.classList.add('dropdown-open');
                }
                event.stopPropagation();
            }
        }
    });

    document.addEventListener('click', function(event) {
        if (!hamburgerMenu.contains(event.target) && !mainNav.contains(event.target)) {
            closeMobileMenu();
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('dropdown-open'));
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
