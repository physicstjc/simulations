document.addEventListener('DOMContentLoaded', function() {
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
            processSimulations(xmlDoc);
            
            // Initialize search functionality
            initializeSearch();
        })
        .catch(error => {
            console.error('Error loading XML:', error);
            alert('Failed to load simulations. Please try again later.');
        });
});

function processSimulations(xmlDoc) {
    const simulations = xmlDoc.querySelectorAll('simulation');
    const container = document.getElementById('simulations-container');
    const navMenu = document.querySelector('.nav-menu');

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
            
            // Initialize topics array if not exists
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

    // Generate nav items in original order
    navMenu.innerHTML = orderedTopics
        .map(([id, topic]) => `<li><a href="#${id}">${topic}</a></li>`)
        .join('');

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
    
    const title = sim.querySelector('title').textContent
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    
    const url = sim.querySelector('shortUrl') ? 
        sim.querySelector('shortUrl').textContent : 
        sim.querySelector('url').textContent;
    
    card.innerHTML = `
        <a href="${url}" target="_blank">
            <img src="${sim.querySelector('image').textContent}" alt="${title}">
        </a>
        <div class="simulation-info">
            <h3>${title}</h3>
            <p>${sim.querySelector('description').textContent}</p>
            <span class="platform">Platform: ${sim.querySelector('platform').textContent}</span>
            <a href="${url}" class="button" target="_blank">Launch Simulation</a>
        </div>
    `;
    
    return card;
}

// Add after your existing DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // Back to top button functionality
    const backToTop = document.getElementById('back-to-top');
    
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    });
    
    backToTop.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});

// Search functionality
function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    if (!searchInput || !searchButton) return;
    
    // Search when button is clicked
    searchButton.addEventListener('click', () => {
        performSearch(searchInput.value);
    });
    
    // Search when Enter key is pressed
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch(searchInput.value);
        }
    });
}

function performSearch(query) {
    if (!query || !window.simulationsXmlDoc) return;
    
    query = query.toLowerCase().trim();
    
    // Get all simulations
    const simulations = window.simulationsXmlDoc.querySelectorAll('simulation');
    const container = document.getElementById('simulations-container');
    
    // Clear current content
    container.innerHTML = '';
    
    // Create search results section
    const searchResultsSection = document.createElement('section');
    searchResultsSection.id = 'search-results';
    searchResultsSection.innerHTML = `<h2>Search Results for "${query}"</h2><div class="simulation-grid"></div>`;
    
    const grid = searchResultsSection.querySelector('.simulation-grid');
    let resultsCount = 0;
    
    // Filter simulations based on search query
    simulations.forEach(sim => {
        const title = sim.querySelector('title').textContent.toLowerCase();
        const description = sim.querySelector('description').textContent.toLowerCase();
        const platform = sim.querySelector('platform').textContent.toLowerCase();
        let topics = '';
        
        sim.querySelectorAll('topic').forEach(topic => {
            topics += topic.textContent.toLowerCase() + ' ';
        });
        
        // Check if any field contains the search query
        if (title.includes(query) || description.includes(query) || 
            platform.includes(query) || topics.includes(query)) {
            grid.appendChild(createSimulationCard(sim));
            resultsCount++;
        }
    });
    
    // Display results or no results message
    if (resultsCount > 0) {
        container.appendChild(searchResultsSection);
        // Add a clear search button
        const clearButton = document.createElement('button');
        clearButton.id = 'clear-search';
        clearButton.textContent = 'Clear Search';
        clearButton.addEventListener('click', () => {
            // Clear search input
            document.getElementById('search-input').value = '';
            // Reprocess all simulations
            processSimulations(window.simulationsXmlDoc);
        });
        container.insertBefore(clearButton, searchResultsSection);
    } else {
        container.innerHTML = `
            <div class="no-results">
                <h2>No results found for "${query}"</h2>
                <p>Try a different search term or browse by category.</p>
                <button id="clear-search">Clear Search</button>
            </div>
        `;
        document.getElementById('clear-search').addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            processSimulations(window.simulationsXmlDoc);
        });
    }
}