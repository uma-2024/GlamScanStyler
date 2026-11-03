const fs = require('fs');
const file = '/Users/ankit/glammefy/GlamScanStyler/src/pages/HomeScreen.tsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

// Find start and end of useQuery block
let startIdx = 695; // // Fetch user profile data
let endIdx = 972; // end of earningsStats

const queryLines = lines.slice(startIdx, endIdx + 1);
const otherLines = [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)];

// Find where to insert (before stylistRating)
const insertIdx = otherLines.findIndex(line => line.includes('const stylistRating = Number(userProfile?.rating ?? 0);')) - 1;

const newLines = [
  ...otherLines.slice(0, insertIdx),
  ...queryLines,
  ...otherLines.slice(insertIdx)
];

fs.writeFileSync(file, newLines.join('\n'));
console.log('Moved queries successfully');
