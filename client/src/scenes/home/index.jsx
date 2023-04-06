import React, { useState } from "react";
import Header from "../../components/Header";
import SearchBar from "./SearchBar";
import ResultSet from "./ResultSet";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  return (
    <div className="flex flex-col justify-center mt-16 mx-auto p-8 max-w-screen-xl">
      <Header />
      <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <ResultSet searchTerm={searchTerm} />
    </div>
  );
}
