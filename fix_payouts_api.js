const fs = require('fs');

let content = fs.readFileSync('src/services/stylistAccountApi.ts', 'utf8');

if (!content.includes('getLoginSession')) {
  content = content.replace(
    "import { API_BASE_URL_WITH_API } from '../config/api';",
    "import { API_BASE_URL_WITH_API } from '../config/api';\nimport { getLoginSession } from '../utils/authStorage';"
  );
}

const newFetchStylistPayouts = `
export const fetchStylistPayouts = async (stylistId: string, limit: number = 50, page: number = 1) => {
  const session = await getLoginSession();
  const token = session?.loginId;
  
  if (!token) {
    throw new Error('Authentication token not found');
  }

  const response = await fetch(\`\${API_BASE_URL_WITH_API}/payouts/stylist/\${stylistId}?limit=\${limit}&page=\${page}\`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${token}\`
    }
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Failed to fetch payouts');
  }
  
  return result;
};
`;

// Replace existing fetchStylistPayouts
content = content.replace(
  /export const fetchStylistPayouts = async \([\s\S]*?\n};\n?/,
  newFetchStylistPayouts.trim() + '\n'
);

fs.writeFileSync('src/services/stylistAccountApi.ts', content);
console.log('stylistAccountApi.ts patched');
