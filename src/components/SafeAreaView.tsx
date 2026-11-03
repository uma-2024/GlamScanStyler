import React from 'react';
import { Platform } from 'react-native';
import {
  SafeAreaView as RNSSafeAreaView,
  SafeAreaViewProps,
} from 'react-native-safe-area-context';

const SafeAreaView: React.FC<SafeAreaViewProps> = (props) => {
  const { edges, ...rest } = props;

  // On iOS, always include the top inset so headers never slip under the notch.
  let finalEdges = edges;
  if (Platform.OS === 'ios') {
    if (Array.isArray(edges)) {
      finalEdges = Array.from(new Set([...edges, 'top']));
    } else if (edges) {
      const edgeRecord = edges as Record<string, string>;
      finalEdges = {
        ...edgeRecord,
        top: edgeRecord.top ?? 'additive',
      } as SafeAreaViewProps['edges'];
    } else {
      finalEdges = ['top', 'left', 'right', 'bottom'];
    }
  }

  return <RNSSafeAreaView edges={finalEdges} {...(rest as any)} />;
};

export default SafeAreaView;
