const searchInput = document.getElementById('calendar-search');
const resultsDiv = document.getElementById('search-results');

if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }

        try {
            const res = await window.apiFetch(window.CRUD_URL || '/Calendar/CRUD.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'search',
                    query: query,
                    id_users: window.currentUserId
                })
            });
            const data = await res.json();

            if (data.length > 0) {
                resultsDiv.innerHTML = data.map(event => `
                    <div class="search-item" onclick="openFoundEvent(${JSON.stringify(event).replace(/"/g, '&quot;')})">
                        <strong>${event.event_title}</strong><br>
                        <small>${event.event_start_date}</small>
                    </div>
                `).join('');
                resultsDiv.style.display = 'block';
            } else {
                resultsDiv.innerHTML = '<div class="search-item">No results found</div>';
            }
        } catch (err) {
            console.error('Search failed:', err);
        }
    });
}

// Global function to handle clicking a search result
window.openFoundEvent = (event) => {
    resultsDiv.style.display = 'none';
    searchInput.value = '';
    // This calls the function we built earlier!
    openEditForm(event); 
};