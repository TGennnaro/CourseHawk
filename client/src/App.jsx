import { NextUIProvider, createTheme } from "@nextui-org/react";
import Home from "./scenes/home";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProfessorPage from "./scenes/professor";
import CourseSearch from "./scenes/course_search";

const darkTheme = createTheme({
  type: "dark",
});

function App() {
  return (
    <>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundImage: "radial-gradient(#0072F5, #000 70%)",
          opacity: 0.2,
          position: "fixed",
        }}
      ></div>
      <div className="z-10 relative">
        <NextUIProvider theme={darkTheme}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/courses" element={<CourseSearch />} />
              <Route path="/professor/:id" element={<ProfessorPage />} />
            </Routes>
          </BrowserRouter>
        </NextUIProvider>
      </div>
    </>
  );
  // return (
  //   <NextUIProvider theme={darkTheme}>
  //     <BrowserRouter>
  //       <Routes>
  //         <Route path="/" element={<Home />} />
  //         <Route path="/professor/:id" element={<ProfessorPage />} />
  //       </Routes>
  //     </BrowserRouter>
  //   </NextUIProvider>
  // );
}

export default App;
