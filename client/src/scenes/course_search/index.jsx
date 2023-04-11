import {
  Checkbox,
  Link,
  Pagination,
  Row,
  Text,
  Tooltip,
} from "@nextui-org/react";
import SearchBar from "../../components/SearchBar";
import FilterDropdown from "../../components/FilterDropdown";
import ResultSet from "./ResultSet";
import { useState } from "react";
import { animateScroll as scroll } from "react-scroll";
import { MdChevronRight } from "react-icons/md";

const FILTER_OPTIONS = {
  rating: {
    ">= 2.0": "Over 2.0",
    ">= 3.0": "Over 3.0",
    ">= 4.0": "Over 4.0",
  },
  difficulty: {
    "<= 4.0": "Under 4.0",
    "<= 3.0": "Under 3.0",
    "<= 2.0": "Under 2.0",
  },
  unrated: {
    true: "UNRATED",
  },
};

export default function CourseSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [resultTotal, setResultTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});

  return (
    <div className="flex flex-col justify-center mx-auto p-8 max-w-screen-xl">
      <Row className="mb-4">
        <Text h1 className="mb-0">
          Search for courses
        </Text>
        <Link href="/" className="mt-auto ml-8">
          Search for professors <MdChevronRight className="ml-1 mt-[3px]" />
        </Link>
      </Row>
      <SearchBar setSearchTerm={setSearchTerm} placeholder="Course name" />
      <Row className="mt-4 flex gap-6 items-end">
        <FilterDropdown
          label="Rating"
          filterKey="rating"
          options={FILTER_OPTIONS.rating}
          filter={filters}
          setFilter={setFilters}
        />
        <FilterDropdown
          label="Difficulty"
          filterKey="difficulty"
          options={FILTER_OPTIONS.difficulty}
          filter={filters}
          setFilter={setFilters}
        />
        <Tooltip content="Show professors who have no ratings">
          <Checkbox
            onChange={(value) => setFilters({ ...filters, unrated: value })}
            className="mb-1"
          >
            Show unrated
          </Checkbox>
        </Tooltip>
        <Tooltip content="Apply the filters to all professors for a course">
          <Checkbox
            onChange={(value) => setFilters({ ...filters, all: value })}
            className="mb-1"
          >
            Apply to all
          </Checkbox>
        </Tooltip>
      </Row>
      <Row className="mt-8" justify="space-between">
        <Text h3 className="mb-0">
          Results:
        </Text>
        <div className="flex gap-4">
          <Pagination
            page={page}
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
      <div className="flex justify-end">
        <Pagination
          page={page}
          total={Math.ceil(resultTotal)}
          onChange={(p) => {
            setPage(p);
            scroll.scrollToTop();
          }}
        />
      </div>
    </div>
  );
}
