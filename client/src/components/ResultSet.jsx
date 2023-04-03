import { Pagination, Row, Text } from "@nextui-org/react";
import RatingCard from "../components/RatingCard";
import { useEffect, useState } from "react";
import pb from "../lib/pocketbase";

export default function ResultSet({ searchTerm }) {
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const PER_PAGE = 5;

  useEffect(() => {
    (async () => {
      const data = await pb.collection("professors").getList(page, PER_PAGE, {
        filter: `name ~ "${searchTerm}"`,
      });
      setResults(data.items);
      setTotal(data.totalPages);
    })();
  }, [page, searchTerm]);

  return (
    <div className="mt-6">
      <Row justify="space-between">
        <Text h3>Results:</Text>
        <Pagination total={Math.ceil(total)} onChange={(p) => setPage(p)} />
      </Row>
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
