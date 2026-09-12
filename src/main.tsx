import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Cloudscape global styles (required for all Cloudscape components)
import "@cloudscape-design/global-styles/index.css";

// -------------------------------------------------------------------
// Theme configuration
// -------------------------------------------------------------------
// Cloudscape supports Light and Dark modes.
// To switch modes, uncomment the appropriate line below:
//
// import { applyMode, Mode } from "@cloudscape-design/global-styles";
// applyMode(Mode.Light);   // Light mode (default)
// applyMode(Mode.Dark);    // Dark mode
//
// To switch density:
// import { applyDensity, Density } from "@cloudscape-design/global-styles";
// applyDensity(Density.Compact);    // Compact density
// applyDensity(Density.Comfortable); // Comfortable density (default)
//
// To apply a custom theme (runtime theming):
// import { applyTheme } from "@cloudscape-design/components/theming";
// const { reset } = applyTheme({
//   theme: {
//     tokens: {
//       colorTextAccent: "#0073bb",
//       fontFamilyBase: "'Open Sans', sans-serif",
//       borderRadiusButton: "4px",
//     },
//     contexts: {
//       "top-navigation": {
//         tokens: { colorTextAccent: "#44b9d6" },
//       },
//     },
//   },
// });
// -------------------------------------------------------------------

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
