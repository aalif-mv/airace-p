/**
 * Loads a CSV file either from a File object or from a URL.
 * Returns a 2D array of parsed rows (numbers converted).
 * Skips header line and empty rows.
 * @param {File|string} source - File object from input OR URL string
 * @returns {Promise<Array<Array<number|string>>>}
 */
async function loadCSV(source) {
    let text;

    if (typeof source === 'string') {
        // Source is a URL (fetch from server or GitHub Pages)
        const res = await fetch(source);
        if (!res.ok) throw new Error('Failed to fetch CSV: ' + res.status);
        text = await res.text();
    } else if (source instanceof File) {
        // Source is a File selected by user
        text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(source);
        });
    } else {
        throw new Error('Invalid CSV source. Must be a File or URL string.');
    }

    const rows = text
        .split('\n')
        .slice(1) // skip header
        .map(row => row.split(',').map(cell => {
            const trimmed = cell.trim();
            const num = parseFloat(trimmed);
            return isNaN(num) ? trimmed : num;
        }))
        .filter(r => r.length > 1 && r[0] !== "");

    return rows;
}
