const fs = require('fs');

let apiContent = fs.readFileSync('src/services/stylistAccountApi.ts', 'utf8');

if (!apiContent.includes('fetchStylistPayouts')) {
  const payoutFunc = `
export const fetchStylistPayouts = async (stylistId: string, limit: number = 50, page: number = 1) => {
  const result = await getJson<{ success?: boolean; data?: any }>(
    \`\${API_BASE_URL_WITH_API}/payouts/stylist/\${stylistId}?limit=\${limit}&page=\${page}\`
  );
  
  if (!result?.success) {
    throw new Error('Failed to fetch payouts');
  }
  
  return result;
};
`;
  fs.writeFileSync('src/services/stylistAccountApi.ts', apiContent + payoutFunc);
  console.log('stylistAccountApi.ts patched');
}

let paymentsContent = fs.readFileSync('src/pages/PaymentsScreen.tsx', 'utf8');
paymentsContent = paymentsContent.replace(
  "import { fetchStylistPayouts } from '../services/accountApi';",
  "import { fetchStylistPayouts } from '../services/stylistAccountApi';"
);
fs.writeFileSync('src/pages/PaymentsScreen.tsx', paymentsContent);
console.log('PaymentsScreen.tsx patched');

if (fs.existsSync('src/services/accountApi.ts')) {
  fs.unlinkSync('src/services/accountApi.ts');
  console.log('Deleted accountApi.ts');
}
