const fs = require('fs');

let content = fs.readFileSync('src/pages/PaymentsScreen.tsx', 'utf8');

// Use correct background color
content = content.replace(/backgroundColor: '#FFF'/g, "backgroundColor: '#FFF3E8'");
// Wait, the header should be the same cream or maybe white, but AccountScreen has it as #FFF3E8 too. Let's see.

// Add compactTopPadding
if (!content.includes('compactTopPadding')) {
  content = content.replace(
    "import { useSafeAreaInsets } from 'react-native-safe-area-context';",
    "import { useSafeAreaInsets } from 'react-native-safe-area-context';\nimport { compactTopPadding } from '../utils/responsiveLayout';"
  );
}

// Remove inline style that I added
content = content.replace(
  "style={[styles.header, { paddingTop: insets.top + 12 }]}",
  "style={styles.header}"
);

// Add to styles
content = content.replace(
  "  header: {\n    flexDirection: 'row',",
  "  header: {\n    flexDirection: 'row',\n    paddingTop: compactTopPadding(20),"
);

fs.writeFileSync('src/pages/PaymentsScreen.tsx', content);
console.log('PaymentsScreen colors fixed');
