import { NextUIProvider, createTheme } from "@nextui-org/react";
import Home from "./scenes/home";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProfessorPage from "./scenes/professor";

const darkTheme = createTheme({
  type: "dark",
});

function App() {
  return (
    <NextUIProvider theme={darkTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/professor/:id" element={<ProfessorPage />} />
        </Routes>
      </BrowserRouter>
    </NextUIProvider>
  );
}

export default App;
