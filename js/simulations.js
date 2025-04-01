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
            processSimulations(xmlDoc);
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

    // Create ordered topics map while preserving XML order
    const topicsMap = new Map();
    const seenTopics = new Set();
    const orderedTopics = [];
    const topics = {};  // Define topics object
    
    simulations.forEach(sim => {
        sim.querySelectorAll('topic').forEach(topicNode => {
            const rawTopic = topicNode.textContent.trim();
            const id = rawTopic.toLowerCase().replace(/[,\s]+/g, '-');
            // Initialize topics array if not exists
            if (!topics[id]) topics[id] = [];
            topics[id].push(sim);
            
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