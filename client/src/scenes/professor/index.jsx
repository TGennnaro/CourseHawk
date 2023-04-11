import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import pb from "../../lib/pocketbase";
import { Button, Card, Link, Row, Text } from "@nextui-org/react";

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
    <div className="flex flex-col justify-center mt-8 mx-auto p-8 max-w-screen-xl">
      <Link href="/" className="mb-8">
        {"< "} Back to search
      </Link>
      <Text h1>{professorData?.name || ""}</Text>
      <Text h3 color="$gray800">
        {professorData?.department || ""}
      </Text>
      {professorData?.legacyId > 0 && (
        <a
          href={
            "https://www.ratemyprofessors.com/professor/" +
            professorData.legacyId
          }
          target="_blank"
          className="mt-4 w-fit"
        >
          <Button>View on RateMyProfessors</Button>
        </a>
      )}
      <Row justify="space-between" className="mt-8 px-20">
        <div className="text-center">
          <Text h1 weight="bold">
            {professorData?.difficulty > 0
              ? professorData?.difficulty?.toFixed(1)
              : "N/A"}
          </Text>
          <Text h4 color="$gray700">
            Difficulty
          </Text>
        </div>
        <div className="text-center">
          <Text h1 weight="bold">
            {professorData?.rating > 0
              ? professorData?.rating?.toFixed(1)
              : "N/A"}
          </Text>
          <Text h4 color="$gray700">
            Based on{" "}
            {professorData?.numRatings > 0 ? professorData?.numRatings : 0}{" "}
            rating
            {professorData?.numRatings != 1 ? "s" : ""}
          </Text>
        </div>
        <div className="text-center">
          <Text h1 weight="bold">
            {professorData?.takeAgain > 0
              ? professorData?.takeAgain?.toFixed(0) + "%"
              : "N/A"}
          </Text>
          <Text h4 color="$gray700">
            Would take again
          </Text>
        </div>
      </Row>
      <div className="mt-8 flex flex-col gap-4">
        {courseData.map((course) => (
          <a
            href={
              "https://wlb-ssweb-01.monmouth.edu/Student/Student/Courses/Search?keyword=" +
              course.number
            }
            target="_blank"
          >
            <Card className="p-4" key={course.number} isPressable>
              <Text h3>{course.name}</Text>
              <div className="flex gap-8">
                <Text color="$gray800">{course.number}</Text>
                <Text color="$gray800">{course.term}</Text>
              </div>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
