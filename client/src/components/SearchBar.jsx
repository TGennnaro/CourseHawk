"use client";

import { Input } from "@nextui-org/react";
import React from "react";

export default function SearchBar({ setSearchTerm, placeholder }) {
  return (
    <Input
      size="xl"
      placeholder={placeholder}
      clearable
      fullWidth
      aria-labelledby="search-bar"
      onInput={(e) => setSearchTerm(e.target.value)}
      onClearClick={() => setSearchTerm("")}
    />
  );
}
