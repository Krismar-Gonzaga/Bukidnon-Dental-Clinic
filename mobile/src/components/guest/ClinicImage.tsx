import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { palette, type } from '../../theme/tokens';

type ClinicImageProps = {
  uri: string | null;
  name: string;
  style: StyleProp<ImageStyle>;
};

/** Clinic photo, or a branded placeholder when there's none (or it can't load offline). */
const ClinicImage = ({ uri, name, style }: ClinicImageProps) => {
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={style}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[style, styles.placeholder]} accessibilityLabel={`${name} photo unavailable`}>
      <View style={styles.circleLarge} />
      <View style={styles.circleSmall} />
      <Icon name="medkit-outline" size={36} color={palette.primary} />
      <Text style={styles.initial} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: palette.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 6,
  },
  circleLarge: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: palette.primaryFixedDim,
    opacity: 0.45,
    top: -70,
    right: -50,
  },
  circleSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: palette.secondaryContainer,
    opacity: 0.35,
    bottom: -50,
    left: -30,
  },
  initial: {
    ...type.labelMd,
    color: palette.onPrimaryFixedVariant,
    paddingHorizontal: 16,
  },
});

export default ClinicImage;
