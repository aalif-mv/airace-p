async function saveCSVFile(rows, filename = 'data.csv') {
  // Convert array to CSV text
  const csvContent = rows.map(r => r.join(',')).join('\n');

  // Ask user to pick a folder
  const dirHandle = await window.showDirectoryPicker();

  // Create or open file in that folder
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();

  // Write and close
  await writable.write(csvContent);
  await writable.close();

  console.log('CSV saved to folder.');
}

// Example usage
saveCSVFile([
  ['timestamp', 'value'],
  [Date.now(), 42],
  [Date.now(), 99]
]);
