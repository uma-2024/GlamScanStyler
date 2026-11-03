const fs = require('fs');

let appContent = fs.readFileSync('App.tsx', 'utf8');

// Add import
if (!appContent.includes("import PaymentsScreen")) {
  appContent = appContent.replace(
    "import AnalyticsScreen from './src/pages/AnalyticsScreen';",
    "import AnalyticsScreen from './src/pages/AnalyticsScreen';\nimport PaymentsScreen from './src/pages/PaymentsScreen';"
  );
}

// Add AppScreen type
if (!appContent.includes("| 'payments'")) {
  appContent = appContent.replace(
    "  | 'history'\n",
    "  | 'history'\n  | 'payments'\n"
  );
}

// Add case in renderScreen
const renderScreenCase = `
      case 'analytics':
        return <AnalyticsScreen onBack={() => navigateBack('analytics')} userId={currentUserId} />;
      case 'payments':
        return <PaymentsScreen navigation={{ goBack: () => navigateBack('payments') }} />;`;

if (!appContent.includes("case 'payments':")) {
  appContent = appContent.replace(
    /      case 'analytics':[\s\S]*?userId={currentUserId} \/>;/,
    renderScreenCase.trim()
  );
}

fs.writeFileSync('App.tsx', appContent);
console.log("App.tsx patched");

let accContent = fs.readFileSync('src/pages/AccountScreen.tsx', 'utf8');
const menuItemsInsert = `
    {
      id: 'payments',
      icon: 'payment',
      label: 'Payments',
      onPress: () => {
        if (onNavigate) onNavigate('payments');
      },
    },`;

if (!accContent.includes("id: 'payments'")) {
  accContent = accContent.replace(
    /    \{\n      id: 'history',[\s\S]*?    \},/,
    match => match + menuItemsInsert
  );
  fs.writeFileSync('src/pages/AccountScreen.tsx', accContent);
  console.log("AccountScreen.tsx patched");
}
