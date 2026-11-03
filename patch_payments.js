const fs = require('fs');

let content = fs.readFileSync('src/pages/PaymentsScreen.tsx', 'utf8');

if (!content.includes('import { getLoginSession }')) {
  content = content.replace(
    "import AsyncStorage from '@react-native-async-storage/async-storage';",
    "import AsyncStorage from '@react-native-async-storage/async-storage';\nimport { getLoginSession } from '../utils/authStorage';"
  );
}

content = content.replace(
  "const userId = await AsyncStorage.getItem('userId');",
  "const session = await getLoginSession();\n      const userId = session?.userId;"
);

fs.writeFileSync('src/pages/PaymentsScreen.tsx', content);
console.log('PaymentsScreen patched');
