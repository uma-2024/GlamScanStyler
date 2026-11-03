# App Store Review Notes

This app is a partner/stylist app for onboarding and managing professional services. It collects the following sensitive data only for the purposes described below:

## Data Collected

- Phone number and OTP verification for account login and authentication.
- Identity and address documents for partner verification.
- Bank details, including account number and IFSC, for payouts.
- Location data for nearby service discovery, home-service workflows, and profile address management.

## Why It Is Collected

- To create and verify partner accounts.
- To approve and manage stylist profiles.
- To process bookings, payouts, subscriptions, ads, and promotions.
- To support service discovery and home-service allocation.

## Important Review Context

- Consent for identity verification is not pre-checked.
- The app shows purpose-specific permission text for sensitive platform permissions.
- The privacy policy in the app discloses the above categories and uses.

## Reviewer Entry Points

- Login and OTP flow: `src/pages/LoginScreen.tsx`
- Identity verification flow: `src/pages/VerifyAccountScreen.tsx`
- Bank details flow: `src/pages/PaymentDetailsScreen.tsx`
- Location permission purpose: `ios/GlamScanStyler/Info.plist`

