// Custom entry point.
//
// Installs global logging / error capture BEFORE the router boots, so uncaught
// errors thrown while route modules evaluate or the app bootstraps are still
// recorded. Order matters: the logger install is a side-effect import placed
// first — ES modules evaluate side-effect imports in source order — so capture
// is active before `expo-router/entry` runs.
import "./services/logger/install";
import "expo-router/entry";
