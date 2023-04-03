"use client";

import { Input } from "@nextui-org/react";
import React from "react";

export default function SearchBar({ searchTerm, setSearchTerm }) {
  return (
    <Input
      size="xl"
      placeholder="Professor name"
      clearable
      fullWidth
      aria-labelledby="search-bar"
      onInput={(e) => {
        setSearchTerm(e.target.value);
      }}
    />
  );
}
