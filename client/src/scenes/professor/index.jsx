import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import pb from "../../lib/pocketbase";
import { Card, Row, Text } from "@nextui-org/react";

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
        sort: "term",
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
      <Row justify="space-between" className="mt-8 px-20">
        <div className="text-center">
          <Text h1 weight="bold">
            {professorData?.difficulty?.toFixed(1)}
          </Text>
          <Text h4 color="$gray700">
            Difficulty
          </Text>
        </div>
        <div className="text-center">
          <Text h1 weight="bold">
            {professorData?.rating?.toFixed(1)}
          </Text>
          <Text h4 color="$gray700">
            Based on {professorData?.numRatings} rating
            {professorData?.numRatings != 1 ? "s" : ""}
          </Text>
        </div>
        <div className="text-center">
          <Text h1 weight="bold">
            {professorData?.takeAgain.toFixed(0)}%
          </Text>
          <Text h4 color="$gray700">
            Would take again
          </Text>
        </div>
      </Row>
      <div className="mt-8 flex flex-col gap-4">
        {courseData.map((course) => (
          <Card className="p-4" key={course.number} isPressable>
            <Text h3>{course.name}</Text>
            <div className="flex gap-8">
              <Text color="$gray800">{course.number}</Text>
              <Text color="$gray800">{course.term}</Text>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
