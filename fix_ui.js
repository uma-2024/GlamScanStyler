const fs = require('fs');

let content = fs.readFileSync('src/pages/PaymentsScreen.tsx', 'utf8');

// Use custom SafeAreaView
content = content.replace(
  "  SafeAreaView,\n} from 'react-native';",
  "} from 'react-native';\nimport SafeAreaView from '../components/SafeAreaView';"
);
content = content.replace(
  "<SafeAreaView style={styles.container}>",
  "<SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>"
);

// Add paddingTop to header using useSafeAreaInsets if not using custom SafeAreaView's top edge
if (!content.includes('import { useSafeAreaInsets }')) {
  content = content.replace(
    "import SafeAreaView from '../components/SafeAreaView';",
    "import SafeAreaView from '../components/SafeAreaView';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';"
  );
}

// Add padding top dynamically
if (!content.includes('const insets = useSafeAreaInsets();')) {
  content = content.replace(
    "const PaymentsScreen = ({ navigation }: any) => {",
    "const PaymentsScreen = ({ navigation }: any) => {\n  const insets = useSafeAreaInsets();"
  );
}

content = content.replace(
  "style={styles.header}",
  "style={[styles.header, { paddingTop: insets.top + 12 }]}"
);

// Fix background color to match app standard
content = content.replace(
  "backgroundColor: '#F5F7FA',",
  "backgroundColor: '#FFF',"
);

fs.writeFileSync('src/pages/PaymentsScreen.tsx', content);
console.log('PaymentsScreen UI fixed');
