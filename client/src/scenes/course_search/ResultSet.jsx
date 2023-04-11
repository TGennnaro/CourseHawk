import RatingCard from "../../components/RatingCard";
import { useEffect, useState } from "react";
import pb from "../../lib/pocketbase";
import CourseCard from "./CourseCard";

export default function ResultSet({
  searchTerm,
  setResultTotal,
  page,
  filters,
}) {
  const [results, setResults] = useState([]);

  const PER_PAGE = 10;

  const filter = [`name ~ "${searchTerm}"`];
  const all = filters.all ? "" : "?";
  if (!filters.unrated) {
    filter.push(`professor.rating ${all}> 0`);
  }
  if (filters.rating) {
    if (filters.unrated) {
      filter.push(
        `(professor.rating ${all}${filters.rating} || professor.rating ?= -1)`
      );
    } else {
      filter.push(`professor.rating ${all}${filters.rating}`);
    }
  }
  if (filters.difficulty) {
    filter.push(`professor.difficulty ${all}${filters.difficulty}`);
  }

  useEffect(() => {
    (async () => {
      const data = await pb.collection("courses").getList(page, PER_PAGE, {
        // filter: filter.join(" && "),
        filter: filter.join(" && "),
        expand: "professor",
        sort: "-professor.rating",
      });
      setResults(data.items);
      setResultTotal(data.totalPages);
    })();
  }, [page, searchTerm, filters]);

  return (
    <div className="mt-4">
      {results && results.length > 0 ? (
        <ul className="m-0">
          {results?.map((item) => (
            <li key={item.id}>
              <CourseCard data={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p>No results</p>
      )}
    </div>
  );
}
