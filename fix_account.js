const fs = require('fs');

let accContent = fs.readFileSync('src/pages/AccountScreen.tsx', 'utf8');

// Replace onNavigate with onPayments
accContent = accContent.replace(
  /if \(onNavigate\) onNavigate\('payments'\);/g,
  "if (onPayments) onPayments();"
);

// Add onPayments to interface AccountScreenProps
if (!accContent.includes("onPayments?: () => void;")) {
  accContent = accContent.replace(
    "onEditProfile?: () => void;",
    "onEditProfile?: () => void;\n  onPayments?: () => void;"
  );
}

// Add onPayments to component props destructuring
if (!accContent.includes("onPayments,")) {
  accContent = accContent.replace(
    "onEditProfile,",
    "onEditProfile,\n  onPayments,"
  );
}

fs.writeFileSync('src/pages/AccountScreen.tsx', accContent);
console.log("AccountScreen patched");

let appContent = fs.readFileSync('App.tsx', 'utf8');
if (!appContent.includes("onPayments={() => {")) {
  appContent = appContent.replace(
    "onEditProfile={() => {",
    "onPayments={() => {\n            setCurrentScreen('payments');\n          }}\n          onEditProfile={() => {"
  );
  fs.writeFileSync('App.tsx', appContent);
  console.log("App.tsx patched");
}
