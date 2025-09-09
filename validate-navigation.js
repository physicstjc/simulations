// Comprehensive navigation validation script
// This script tests all topic filtering functionality

class NavigationValidator {
    constructor() {
        this.allTopics = [
            'measurement', 'kinematics', 'dynamics', 'forces', 'turning-effect-of-forces',
            'pressure', 'energy-work-power', 'motion-in-a-circle', 'gravitational-field',
            'thermal-physics', 'kinetic-model-of-matter', 'oscillations', 'waves',
            'superposition', 'light', 'electromagnetic-spectrum', 'sound', 'electric-fields',
            'electricity', 'magnetism', 'electromagnetism', 'electromagnetic-induction',
            'alternating-current', 'nuclear-physics', 'quantum-physics', 'general',
            'graphing-technique'
        ];
        
        this.results = [];
        this.xmlDoc = null;
    }
    
    // Convert topic ID to display name
    topicIdToDisplayName(topicId) {
        return topicId.replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    // Load XML data
    async loadXMLData() {
        try {
            const response = await fetch('data/simulations.xml');
            const xmlText = await response.text();
            const parser = new DOMParser();
            this.xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            window.simulationsXmlDoc = this.xmlDoc; // Set global variable
            return true;
        } catch (error) {
            console.error('Failed to load XML:', error);
            return false;
        }
    }
    
    // Test if a topic has simulations in XML
    testTopicInXML(topicId) {
        if (!this.xmlDoc) return { success: false, count: 0, message: 'XML not loaded' };
        
        const simulations = this.xmlDoc.querySelectorAll('simulation');
        let matchingCount = 0;
        
        simulations.forEach(sim => {
            const topics = Array.from(sim.querySelectorAll('topic')).map(t => t.textContent.trim());
            if (topics.some(topic => topic === topicId || topic.toLowerCase() === topicId)) {
                matchingCount++;
            }
        });
        
        return {
            success: matchingCount > 0,
            count: matchingCount,
            message: matchingCount > 0 ? `${matchingCount} simulations found` : 'No simulations found'
        };
    }
    
    // Test if navigation button exists for topic
    testNavigationButton(topicDisplayName) {
        const buttons = document.querySelectorAll('.dropdown-link');
        const button = Array.from(buttons).find(btn => 
            btn.getAttribute('data-topic') === topicDisplayName ||
            btn.textContent.trim() === topicDisplayName
        );
        
        return {
            success: !!button,
            element: button,
            message: button ? 'Navigation button found' : 'Navigation button missing'
        };
    }
    
    // Test filtering functionality
    async testTopicFiltering(topicDisplayName) {
        // Simulate clicking the navigation button
        if (typeof filterByTopic === 'function') {
            try {
                filterByTopic(topicDisplayName);
                
                // Check if content was filtered
                const container = document.getElementById('simulations-container');
                const hasContent = container && container.innerHTML.trim() !== '';
                const hasNoResults = container && container.innerHTML.includes('No simulations found');
                
                return {
                    success: hasContent && !hasNoResults,
                    message: hasContent ? 
                        (hasNoResults ? 'No results message displayed' : 'Content filtered successfully') :
                        'No content generated'
                };
            } catch (error) {
                return {
                    success: false,
                    message: `Filtering error: ${error.message}`
                };
            }
        } else {
            return {
                success: false,
                message: 'filterByTopic function not available'
            };
        }
    }
    
    // Run comprehensive test for a single topic
    async testSingleTopic(topicId) {
        const displayName = this.topicIdToDisplayName(topicId);
        
        const xmlTest = this.testTopicInXML(topicId);
        const navTest = this.testNavigationButton(displayName);
        const filterTest = await this.testTopicFiltering(displayName);
        
        return {
            topicId,
            displayName,
            xmlTest,
            navTest,
            filterTest,
            overallSuccess: xmlTest.success && navTest.success && filterTest.success
        };
    }
    
    // Run tests for all topics
    async validateAllTopics() {
        console.log('Starting comprehensive navigation validation...');
        
        // Load XML data first
        const xmlLoaded = await this.loadXMLData();
        if (!xmlLoaded) {
            console.error('Failed to load XML data');
            return false;
        }
        
        // Wait for page to be ready
        await new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
        
        // Test each topic
        this.results = [];
        for (const topicId of this.allTopics) {
            const result = await this.testSingleTopic(topicId);
            this.results.push(result);
            
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.generateReport();
        return true;
    }
    
    // Generate validation report
    generateReport() {
        const successful = this.results.filter(r => r.overallSuccess);
        const failed = this.results.filter(r => !r.overallSuccess);
        
        console.log('\n=== NAVIGATION VALIDATION REPORT ===');
        console.log(`Total Topics Tested: ${this.results.length}`);
        console.log(`Successful: ${successful.length}`);
        console.log(`Failed: ${failed.length}`);
        console.log(`Success Rate: ${Math.round((successful.length / this.results.length) * 100)}%`);
        
        if (failed.length > 0) {
            console.log('\n--- FAILED TOPICS ---');
            failed.forEach(result => {
                console.log(`\n${result.displayName} (${result.topicId}):`);
                if (!result.xmlTest.success) console.log(`  ❌ XML: ${result.xmlTest.message}`);
                if (!result.navTest.success) console.log(`  ❌ Navigation: ${result.navTest.message}`);
                if (!result.filterTest.success) console.log(`  ❌ Filtering: ${result.filterTest.message}`);
            });
        }
        
        if (successful.length > 0) {
            console.log('\n--- SUCCESSFUL TOPICS ---');
            successful.forEach(result => {
                console.log(`✅ ${result.displayName}: ${result.xmlTest.count} simulations`);
            });
        }
        
        // Summary by category
        const categories = {
            'Mechanics': ['measurement', 'kinematics', 'dynamics', 'forces', 'turning-effect-of-forces', 'pressure', 'energy-work-power', 'motion-in-a-circle', 'gravitational-field'],
            'Thermodynamics': ['thermal-physics', 'kinetic-model-of-matter'],
            'Waves & Optics': ['oscillations', 'waves', 'superposition', 'light', 'electromagnetic-spectrum', 'sound'],
            'Electricity & Magnetism': ['electric-fields', 'electricity', 'magnetism', 'electromagnetism', 'electromagnetic-induction', 'alternating-current'],
            'Modern Physics': ['nuclear-physics', 'quantum-physics'],
            'General': ['general', 'graphing-technique']
        };
        
        console.log('\n--- CATEGORY SUMMARY ---');
        Object.entries(categories).forEach(([category, topics]) => {
            const categoryResults = this.results.filter(r => topics.includes(r.topicId));
            const categorySuccess = categoryResults.filter(r => r.overallSuccess);
            console.log(`${category}: ${categorySuccess.length}/${categoryResults.length} topics working`);
        });
        
        return {
            total: this.results.length,
            successful: successful.length,
            failed: failed.length,
            successRate: Math.round((successful.length / this.results.length) * 100),
            results: this.results
        };
    }
}

// Auto-run validation when script is loaded
if (typeof window !== 'undefined') {
    window.NavigationValidator = NavigationValidator;
    
    // Run validation after page loads
    window.addEventListener('load', async () => {
        // Wait a bit for all scripts to initialize
        setTimeout(async () => {
            const validator = new NavigationValidator();
            await validator.validateAllTopics();
        }, 2000);
    });
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationValidator;
}