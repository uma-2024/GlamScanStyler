import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import NativeLinearGradient from 'react-native-linear-gradient';

type AppLinearGradientProps = React.ComponentProps<typeof NativeLinearGradient>;

const AppLinearGradient: React.FC<AppLinearGradientProps> = ({
  children,
  style,
  ...props
}) => {
  const flattenedStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const radiusStyle =
    flattenedStyle?.borderRadius !== undefined
      ? { borderRadius: flattenedStyle.borderRadius, overflow: 'hidden' as const }
      : undefined;

  return (
    <View style={[style, radiusStyle]}>
      <NativeLinearGradient
        {...props}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          radiusStyle,
        ]}
      />
      {children}
    </View>
  );
};

export default AppLinearGradient;
