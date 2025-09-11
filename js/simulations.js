document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking navigation element...');
    const testNav = document.getElementById('navigation');
    console.log('Navigation element exists:', !!testNav, testNav);
    
    // Use relative path when served via web server
    fetch('data/simulations.xml')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(str => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(str, "text/xml");
            // Check for XML parsing errors
            const errorNode = xmlDoc.querySelector('parsererror');
            if (errorNode) {
                throw new Error('XML parsing error: ' + errorNode.textContent);
            }
            // Store the XML document globally for search functionality
            window.simulationsXmlDoc = xmlDoc;
            try {
                processSimulations(xmlDoc);
                // Initialize search functionality
                initializeSearch();
            } catch (error) {
                console.error('Error in processSimulations:', error);
                // Try to at least show a basic navigation
                console.log('Try-catch: Looking for navigation element...');
                const navContainer = document.getElementById('navigation');
                console.log('Try-catch: Navigation container found:', navContainer);
                if (navContainer) {
                    navContainer.innerHTML = '<p>Navigation loading error. Please refresh the page.</p>';
                }
            }
        })
        .catch(error => {
            console.error('Error loading XML:', error);
            console.error('Error stack:', error.stack);
            // Create fallback navigation
            console.log('Looking for navigation element...');
            const navContainer = document.getElementById('navigation');
            console.log('Navigation container found:', navContainer);
            if (navContainer) {
                navContainer.innerHTML = `
                    <ul class="nav-menu">
                        <li class="nav-item">
                            <button class="nav-button" data-theme="Mechanics">Mechanics</button>
                            <div class="dropdown-menu">
                                <ul class="dropdown-list">
                                    <li><a href="#measurement" class="dropdown-link">Measurement</a></li>
                                    <li><a href="#kinematics" class="dropdown-link">Kinematics</a></li>
                                    <li><a href="#dynamics" class="dropdown-link">Dynamics</a></li>
                                    <li><a href="#forces" class="dropdown-link">Forces</a></li>
                                </ul>
                            </div>
                        </li>
                    </ul>
                `;
                // Initialize search functionality after fallback navigation is created
                initializeSearch();
            }
        });
});

function processSimulations(xmlDoc) {
    console.log('Starting processSimulations');
    const simulations = xmlDoc.querySelectorAll('simulation');
    const container = document.getElementById('simulations-container');
    const navContainer = document.getElementById('navigation');
    
    console.log('Container found:', !!container);
    console.log('NavContainer found:', !!navContainer);
    
    if (!container || !navContainer) {
        console.error('Required DOM elements not found - container:', !!container, 'navContainer:', !!navContainer);
        return;
    }

    const isJavaScriptPage = window.location.pathname.includes('javascript.html');

    // Create ordered topics map while preserving XML order
    const topicsMap = new Map();
    const seenTopics = new Set();
    const orderedTopics = [];
    const topics = {};  // Define topics object
    
    simulations.forEach(sim => {
        // Filter simulations if on the JavaScript-only page
        if (isJavaScriptPage && sim.querySelector('platform').textContent !== 'JavaScript') {
            return; // Skip this simulation if it's not JavaScript and we are on the JS page
        }

        // Use a Set to track simulations already added to avoid duplicates
        const addedToTopics = new Set();

        sim.querySelectorAll('topic').forEach(topicNode => {
            const rawTopic = topicNode.textContent.trim();
            const id = rawTopic.toLowerCase().replace(/[,\s]+/g, '-');
            
            // Initialize topic array if it doesn't exist
            if (!topics[id]) {
                topics[id] = [];
            }

            // Add simulation to topic only if not already added for this topic
            if (!addedToTopics.has(sim)) {
                topics[id].push(sim);
                addedToTopics.add(sim);
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

    // Create simple menu bar with theme buttons
    const themes = {
        'Mechanics': ['measurement', 'kinematics', 'dynamics', 'forces', 'turning-effect-of-forces', 'pressure', 'energy-work-power', 'motion-in-a-circle', 'gravitational-field'],
        'Thermodynamics': ['thermal-physics', 'kinetic-model-of-matter'],
        'Waves & Optics': ['oscillations', 'waves', 'superposition', 'light', 'electromagnetic-spectrum', 'sound'],
        'Electricity & Magnetism': ['electric-fields', 'electricity', 'magnetism', 'electromagnetism', 'electromagnetic-induction', 'alternating-current'],
        'Modern Physics': ['nuclear-physics', 'quantum-physics'],
        'General': ['general', 'graphing-technique']
    };

    // Create theme buttons with dropdowns
    let navHTML = '';
    Object.entries(themes).forEach(([themeName, themeTopics]) => {
        const availableTopics = themeTopics.filter(topicId => 
            orderedTopics.some(([id]) => id === topicId)
        );
        
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
    
    // Add uncategorized topics
    const categorizedTopics = Object.values(themes).flat();
    const otherTopics = orderedTopics.filter(([id]) => 
        !categorizedTopics.includes(id)
    );
    
    if (otherTopics.length > 0) {
        navHTML += `
            <li class="nav-item">
                <button class="nav-button" data-theme="Other">Other Topics</button>
                <div class="dropdown-menu">
                    <ul class="dropdown-list">
                        ${otherTopics.map(([id, topic]) => 
                            `<li><button class="dropdown-link" data-topic="${topic}">${topic}</button></li>`
                        ).join('')}
                    </ul>
                </div>
            </li>
        `;
    }
    
    // Double-check navContainer exists before setting innerHTML
    if (!navContainer) {
        console.error('Navigation container is null at innerHTML assignment');
        return;
    }
    navContainer.innerHTML = `<ul class="nav-menu">${navHTML}</ul>`;
    
    // Add click handlers for navigation filtering
    setupNavigationHandlers();

    // Render sections in the same order as navigation
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
    
    const title = sim.querySelector('title').textContent;
    const description = sim.querySelector('description')?.textContent || '';
    const imageUrl = sim.querySelector('image')?.textContent || '';
    const simUrl = sim.querySelector('url').textContent;
    const platform = sim.querySelector('platform').textContent;
    
    card.innerHTML = `
        <div class="card-image">
            <img src="${imageUrl}" alt="${title}" onerror="this.src='https://via.placeholder.com/300x180?text=No+Image'">
        </div>
        <div class="card-content">
            <h3>${title}</h3>
            <p class="description">${description}</p>
            <div class="card-footer">
                <span class="platform">${platform}</span>
                <a href="${simUrl}" target="_blank" class="button">Launch</a>
            </div>
        </div>
    `;
    
    return card;
}

// Search functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', function() {
            const query = searchInput.value.trim();
            if (query) {
                performSearch(query);
            }
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    performSearch(query);
                }
            }
        });
    }
});

function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', function() {
            const query = searchInput.value.trim();
            if (query) {
                performSearch(query);
            }
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    performSearch(query);
                }
            }
        });
    }
}

function performSearch(query) {
    if (!window.simulationsXmlDoc) {
        console.error('XML document not loaded yet');
        return;
    }
    
    const simulations = window.simulationsXmlDoc.querySelectorAll('simulation');
    const container = document.getElementById('simulations-container');
    
    if (!container) {
        console.error('Simulations container not found');
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    const matchingSimulations = [];
    const queryLower = query.toLowerCase();
    
    simulations.forEach(sim => {
        const title = sim.querySelector('title').textContent.toLowerCase();
        const description = sim.querySelector('description')?.textContent?.toLowerCase() || '';
        const topics = Array.from(sim.querySelectorAll('topic')).map(t => t.textContent.toLowerCase());
        
        if (title.includes(queryLower) || 
            description.includes(queryLower) || 
            topics.some(topic => topic.includes(queryLower))) {
            matchingSimulations.push(sim);
        }
    });
    
    if (matchingSimulations.length === 0) {
        container.innerHTML = `<div class="no-results"><h2>No results found for "${query}"</h2><p>Try different keywords or browse by category.</p></div>`;
        return;
    }
    
    // Create search results section
    const section = document.createElement('section');
    section.innerHTML = `<h2>Search Results for "${query}" (${matchingSimulations.length} found)</h2><div class="simulation-grid"></div>`;
    
    const grid = section.querySelector('.simulation-grid');
    matchingSimulations.forEach(sim => {
        grid.appendChild(createSimulationCard(sim));
    });
    
    container.appendChild(section);
}

function setupNavigationHandlers() {
    const dropdownLinks = document.querySelectorAll('.dropdown-link');
    
    dropdownLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const topic = this.getAttribute('data-topic');
            if (topic) {
                filterByTopic(topic);
            }
        });
    });
}

function filterByTopic(topicName) {
    if (!window.simulationsXmlDoc) {
        console.error('XML document not loaded yet');
        return;
    }
    
    const simulations = window.simulationsXmlDoc.querySelectorAll('simulation');
    const container = document.getElementById('simulations-container');
    
    if (!container) {
        console.error('Simulations container not found');
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    const matchingSimulations = [];
    // Convert display name back to topic ID format for matching
    const topicId = topicName.toLowerCase().replace(/\s+/g, '-');
    
    simulations.forEach(sim => {
        const topics = Array.from(sim.querySelectorAll('topic')).map(t => t.textContent.trim());
        
        // Check if any topic matches the selected topic ID
        if (topics.some(topic => topic === topicId || topic.toLowerCase() === topicId)) {
            matchingSimulations.push(sim);
        }
    });
    
    if (matchingSimulations.length === 0) {
        container.innerHTML = `<div class="no-results"><h2>No simulations found for "${topicName}"</h2><p>Try browsing other categories.</p></div>`;
        return;
    }
    
    // Create filtered results section
    const section = document.createElement('section');
    section.innerHTML = `<h2>${topicName} (${matchingSimulations.length} simulations)</h2><div class="simulation-grid"></div>`;
    
    const grid = section.querySelector('.simulation-grid');
    matchingSimulations.forEach(sim => {
        grid.appendChild(createSimulationCard(sim));
    });
    
    container.appendChild(section);
}


// Add this to your existing simulations.js file

// Enhanced Mobile Menu Toggle Functionality
function initializeMobileMenu() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const mainNav = document.getElementById('main-nav');
    
    if (hamburgerMenu && mainNav) {
        // Function to close the mobile menu
        function closeMobileMenu() {
            hamburgerMenu.classList.remove('active');
            mainNav.classList.remove('active');
            hamburgerMenu.setAttribute('aria-expanded', 'false');
        }
        
        // Toggle menu when hamburger is clicked
        hamburgerMenu.addEventListener('click', function() {
            hamburgerMenu.classList.toggle('active');
            mainNav.classList.toggle('active');
            
            const isExpanded = mainNav.classList.contains('active');
            hamburgerMenu.setAttribute('aria-expanded', isExpanded);
        });
        
        // Close menu when any navigation button is clicked (topic selection)
        mainNav.addEventListener('click', function(event) {
        // Check if clicked element is a dropdown link (topic) - NOT nav-button (theme)
        if (event.target.classList.contains('dropdown-link') ||
        event.target.closest('.dropdown-link')) {
        
        // Only close on mobile (when hamburger menu is visible)
        if (window.innerWidth <= 768) {
            closeMobileMenu();
        }
    }
    
    // Handle nav-button clicks for dropdown toggle (don't close menu)
    if (event.target.classList.contains('nav-button') ||
        event.target.closest('.nav-button')) {
        
        // Only on mobile - toggle dropdown visibility
        if (window.innerWidth <= 768) {
            const navItem = event.target.closest('.nav-item');
            if (navItem) {
                // Toggle dropdown-open class for this nav item
                navItem.classList.toggle('dropdown-open');
                
                // Close other open dropdowns
                const allNavItems = document.querySelectorAll('.nav-item');
                allNavItems.forEach(item => {
                    if (item !== navItem) {
                        item.classList.remove('dropdown-open');
                    }
                });
            }
        }
    }
});
        
        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!hamburgerMenu.contains(event.target) && !mainNav.contains(event.target)) {
                closeMobileMenu();
            }
        });
        
        // Close menu when window is resized to desktop size
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        });
        
        // Close menu when pressing Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && mainNav.classList.contains('active')) {
                closeMobileMenu();
            }
        });
    }
}

// Initialize mobile menu after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Your existing initialization code...
    
    // Add mobile menu initialization
    initializeMobileMenu();
});
