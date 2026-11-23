import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";

const ReducedMotion = createContext(true);
export const useReducedMotion = () => useContext(ReducedMotion);

export function MotionProvider({ children }: PropsWithChildren) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (Platform.OS === "web" && typeof matchMedia === "function") {
      const media = matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => setReduced(media.matches);
      update();
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    let current = true;
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        current = false;
        setReduced(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (current) setReduced(value);
      })
      .catch(() => {});
    return () => {
      current = false;
      sub.remove();
    };
  }, []);
  return (
    <ReducedMotion.Provider value={reduced}>{children}</ReducedMotion.Provider>
  );
}

/** Animate discrete reveals, never a stream of text updates. */
export function Reveal({ children }: PropsWithChildren) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [5, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
