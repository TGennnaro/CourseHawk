import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import pb from "../../lib/pocketbase";
import { Text } from "@nextui-org/react";

export default function ProfessorPage() {
  const id = useParams().id;
  const [professorData, setProfessorData] = useState({});
  const [courseData, setCourseData] = useState([]);

  useEffect(() => {
    (async () => {
      const professor = await pb
        .collection("professors")
        .getFirstListItem(`id = "${id}"`, {
          $cancelKey: "professor",
        });
      setProfessorData(professor);

      const courses = await pb.collection("courses").getFullList({
        filter: `professor ~ "${id}"`,
        expand: "professor",
        $cancelKey: "courses",
      });
      setCourseData(courses);
    })();
  }, []);

  return (
    <div className="flex flex-col justify-center mt-16 mx-auto p-8 max-w-screen-xl">
      <Text h1>{professorData?.name || ""}</Text>
      <Text h3 color="$gray800">
        {professorData?.department || ""}
      </Text>
    </div>
  );
}
