import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useLibraryStore } from "./src/store/libraryStore";

export default function App() {
  const hydrateFavorites = useLibraryStore((s) => s.hydrate);

  useEffect(() => {
    hydrateFavorites();
  }, [hydrateFavorites]);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
