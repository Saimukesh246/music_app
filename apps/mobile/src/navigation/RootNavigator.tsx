import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TabNavigator } from "./TabNavigator";
import { NowPlayingScreen } from "../screens/NowPlayingScreen";
import { PlaylistDetailScreen } from "../screens/PlaylistDetailScreen";
import { ArtistDetailScreen } from "../screens/ArtistDetailScreen";

export type RootStackParamList = {
  Home: undefined;
  NowPlaying: undefined;
  PlaylistDetail: { playlistId: string };
  ArtistDetail: { artistId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={TabNavigator} />
        <Stack.Screen
          name="NowPlaying"
          component={NowPlayingScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="PlaylistDetail"
          component={PlaylistDetailScreen}
        />
        <Stack.Screen
          name="ArtistDetail"
          component={ArtistDetailScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
