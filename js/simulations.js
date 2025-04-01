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
    
    // Group by topic first
    const topics = {};
    simulations.forEach(sim => {
        const topicNodes = sim.querySelectorAll('topic');
        topicNodes.forEach(topicNode => {
            const topic = topicNode.textContent.trim(); // Keep the original topic name from XML
            if (!topics[topic]) {
                topics[topic] = [];
            }
            topics[topic].push(sim);
        });
    });
    
    // Render each topic section
    for (const [topic, sims] of Object.entries(topics)) {
        const section = document.createElement('section');
        section.id = topic; // Use the exact topic name as ID
        section.innerHTML = `<h2>${topic.replace(/-/g, ' ')}</h2><div class="simulation-grid"></div>`;
        
        const grid = section.querySelector('.simulation-grid');
        sims.forEach(sim => {
            grid.appendChild(createSimulationCard(sim));
        });
        
        container.appendChild(section);
    }
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