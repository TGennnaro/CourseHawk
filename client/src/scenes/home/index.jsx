import React, { useState } from "react";
import SearchBar from "./SearchBar";
import ResultSet from "./ResultSet";
import { Button, Pagination, Row, Text } from "@nextui-org/react";
import { FaFilter } from "react-icons/fa";
import FilterModal from "./FilterModal";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [resultTotal, setResultTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({});

  return (
    <div className="flex flex-col justify-center mt-16 mx-auto p-8 max-w-screen-xl">
      <Text h1>Search your favorite professors</Text>
      <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <Row className="mt-8" justify="space-between">
        <Text h3>Results:</Text>
        <div className="flex gap-4">
          <Button auto icon={<FaFilter />} onPress={() => setFilterOpen(true)}>
            Filters
          </Button>
          <Pagination
            total={Math.ceil(resultTotal)}
            onChange={(p) => setPage(p)}
          />
        </div>
      </Row>
      <ResultSet
        searchTerm={searchTerm}
        setResultTotal={setResultTotal}
        page={page}
        filters={filters}
      />
      <FilterModal
        filters={filters}
        setFilters={setFilters}
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  );
}
