import { NextUIProvider, createTheme } from "@nextui-org/react";
import Header from "./components/Header";
import SearchBar from "./components/SearchBar";
import Home from "./scenes/home";

const darkTheme = createTheme({
  type: "dark",
});

function App() {
  return (
    <NextUIProvider theme={darkTheme}>
      <Home />
    </NextUIProvider>
  );
}

export default App;
