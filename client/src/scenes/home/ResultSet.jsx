import RatingCard from "../../components/RatingCard";
import { useEffect, useState } from "react";
import pb from "../../lib/pocketbase";

export default function ResultSet({ searchTerm, setResultTotal, page }) {
  const [results, setResults] = useState([]);

  const PER_PAGE = 10;

  useEffect(() => {
    (async () => {
      const data = await pb.collection("professors").getList(page, PER_PAGE, {
        filter: `name ~ "${searchTerm}"`,
        sort: "-rating",
      });
      setResults(data.items);
      setResultTotal(data.totalPages);
    })();
  }, [page, searchTerm]);

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
