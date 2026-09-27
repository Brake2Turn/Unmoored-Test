import { useCallback, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

/**
 * The size a screen has actually been given, measured, rather than the size
 * of the window.
 *
 * They are not always the same. In the Claude app on a phone the game is shown
 * under the app's own bar, in an area shorter than the window reports, and
 * star select sized its chart from the window: the chart ran down behind
 * "3 STARS IN RANGE" and the JUMP button, which sat where the screen really
 * ended. A test browser gives the game the whole window, so it never showed
 * there. Starts from the window's size so the first frame is close, then
 * follows the screen's own layout.
 *
 * Put `onLayout` on the screen's outermost view.
 */
export function useScreenBox() {
  const window = useWindowDimensions();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) =>
      current && current.width === width && current.height === height ? current : { width, height },
    );
  }, []);
  return { width: box?.width ?? window.width, height: box?.height ?? window.height, onLayout };
}
