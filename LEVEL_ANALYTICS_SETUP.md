# Level Analytics Modal Component

A React Native component that displays gamification performance metrics and level progress, similar to freelancer platforms.

## Features

✅ **Performance Metrics Display**
- Success Score (0-10)
- Rating (0-5)
- Response Rate (0-100)

✅ **Level Progression**
- Visual progression through 4 levels: New → Level 1 → Level 2 → Top Rated
- Current level highlighting
- Level icons for visual differentiation

✅ **Interactive Elements**
- Tooltip explanations for each metric
- Smooth animations and transitions
- Scrollable content for mobile optimization

✅ **Visual Feedback**
- Progress bars with color coding (orange for below threshold, green for qualified)
- "Qualify for next level" indicators showing threshold values
- Responsive design for different screen sizes

## Installation

The component uses the following dependencies (already in GlamScanStyler):
- `react-native`
- `react-native-vector-icons`
- `react-native-linear-gradient` (if using gradient variants in future)

No additional installation needed!

## Usage

### Basic Implementation

```tsx
import React, { useState } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import LevelAnalyticsModal from '../components/LevelAnalyticsModal';

const MyScreen = () => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setModalVisible(true)}>
        <Text>View My Level</Text>
      </TouchableOpacity>

      <LevelAnalyticsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        currentLevel="level1"
        successScore={7.2}
        rating={4.6}
        responseRate={85}
        nextLevelThresholds={{
          successScore: 8,
          rating: 4.7,
          responseRate: 90,
        }}
      />
    </>
  );
};

export default MyScreen;
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `visible` | boolean | Yes | Controls modal visibility |
| `onClose` | function | Yes | Callback when close button is pressed |
| `currentLevel` | 'new' \| 'level1' \| 'level2' \| 'top-rated' | Yes | Current user level |
| `successScore` | number | Yes | User's success score (0-10) |
| `rating` | number | Yes | User's rating (0-5) |
| `responseRate` | number | Yes | User's response rate (0-100) |
| `nextLevelThresholds` | object | No | Thresholds for next level (defaults shown below) |

### Default Thresholds
```tsx
{
  successScore: 7,     // Need 7/10 to qualify
  rating: 4.4,         // Need 4.4/5 to qualify
  responseRate: 80     // Need 80% to qualify
}
```

## Example Integration

### In a Profile Screen

```tsx
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import LevelAnalyticsModal from '../components/LevelAnalyticsModal';

const ProfileScreen = ({ userId }) => {
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [userMetrics, setUserMetrics] = useState(null);

  useEffect(() => {
    // Fetch user metrics from API
    fetchUserMetrics(userId);
  }, [userId]);

  const fetchUserMetrics = async (id) => {
    // Call your API endpoint
    const response = await fetch(`/api/users/${id}/metrics`);
    const data = await response.json();
    setUserMetrics(data);
  };

  if (!userMetrics) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.levelButton}
        onPress={() => setShowLevelModal(true)}
      >
        <Text>{userMetrics.level}</Text>
      </TouchableOpacity>

      <LevelAnalyticsModal
        visible={showLevelModal}
        onClose={() => setShowLevelModal(false)}
        currentLevel={userMetrics.level}
        successScore={userMetrics.successScore}
        rating={userMetrics.rating}
        responseRate={userMetrics.responseRate}
        nextLevelThresholds={{
          successScore: 7,
          rating: 4.4,
          responseRate: 80,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  levelButton: {
    padding: 16,
    backgroundColor: '#FFC107',
    borderRadius: 8,
  },
});

export default ProfileScreen;
```

## Demo Page

A demo page is available at `src/pages/LevelAnalyticsDemo.tsx` that shows:
- All level variants (New, Level 1, Level 2, Top Rated)
- Different metric values for each level
- Preview of currently selected metrics

Navigate to this page to test the component with various configurations.

## Customization

### Changing Level Labels and Icons

Edit `LevelAnalyticsModal.tsx` in the `levels` array:

```tsx
const levels = [
  { key: 'new', label: 'Custom Label', icon: 'custom-icon' },
  // ... more levels
];
```

### Modifying Tooltip Text

Update the `tooltips` object in the component:

```tsx
const tooltips = {
  successScore: 'Your custom tooltip text here',
  // ... other tooltips
};
```

### Styling

All styles are defined in the `StyleSheet.create()` at the bottom. Modify colors, sizes, and spacing there:

```tsx
const styles = StyleSheet.create({
  levelBadge: {
    width: 100,  // Adjust size
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8E8E8', // Adjust colors
    // ...
  },
  // ... more styles
});
```

## Color Scheme

- **Primary**: `#FFC107` (Yellow - active level)
- **Success**: `#4CAF50` (Green - qualified threshold)
- **Warning**: `#FF9800` (Orange - below threshold)
- **Background**: `#E8E8E8` (Light gray)
- **Text**: `#333` (Dark gray)
- **Muted**: `#999` (Medium gray)

## API Integration Example

When integrating with your backend:

```tsx
const fetchUserLevel = async (userId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/users/${userId}/level-analytics`
    );
    const data = await response.json();
    setMetrics({
      successScore: data.successScore,
      rating: data.rating,
      responseRate: data.responseRate,
      level: data.currentLevel,
    });
  } catch (error) {
    console.error('Failed to fetch level analytics:', error);
  }
};
```

Expected API response format:
```json
{
  "currentLevel": "level1",
  "successScore": 7.2,
  "rating": 4.6,
  "responseRate": 85,
  "nextLevelThresholds": {
    "successScore": 8,
    "rating": 4.7,
    "responseRate": 90
  }
}
```

## Files

- **Component**: `src/components/LevelAnalyticsModal.tsx`
- **Demo Page**: `src/pages/LevelAnalyticsDemo.tsx`
- **Documentation**: `LEVEL_ANALYTICS_SETUP.md` (this file)

## Notes

- The component is mobile-optimized for React Native
- All values are fully customizable based on your requirements
- The modal slides from the bottom for better UX on mobile
- Tooltips are interactive and can be toggled by tapping the info icon
- Progress bars dynamically update based on provided metric values
