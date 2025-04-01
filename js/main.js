document.addEventListener('DOMContentLoaded', function() {
    fetch('data/simulations.xml')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(str => new DOMParser().parseFromString(str, "text/xml"))
        .then(data => {
            processSimulations(data);
        })
        .catch(error => {
            console.error('Error loading the XML file:', error);
            document.getElementById('simulations-container').innerHTML = 
                '<p class="error">Error loading simulations. Please try again later.</p>';
        });
});
