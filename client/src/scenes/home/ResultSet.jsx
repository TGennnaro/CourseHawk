import RatingCard from "../../components/RatingCard";
import { useEffect, useState } from "react";
import pb from "../../lib/pocketbase";

export default function ResultSet({
  searchTerm,
  setResultTotal,
  page,
  filters,
}) {
  const [results, setResults] = useState([]);

  const PER_PAGE = 10;

  const filter = [`name ~ "${searchTerm}"`];
  if (!filters.unrated) {
    filter.push("rating > 0");
  }
  if (filters.rating) {
    filter.push(`rating ${filters.rating}`);
  }
  if (filters.difficulty) {
    filter.push(`difficulty ${filters.difficulty}`);
  }

  useEffect(() => {
    (async () => {
      const data = await pb.collection("professors").getList(page, PER_PAGE, {
        filter: filter.join(" && "),
        sort: "-rating",
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
              <RatingCard data={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p>No results</p>
      )}
    </div>
  );
}
