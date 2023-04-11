import { Badge, Card, Row, Text } from "@nextui-org/react";
import { MdStarOutline } from "react-icons/md";

export default function CourseCard({ data }) {
  return (
    <a
      href={
        "https://wlb-ssweb-01.monmouth.edu/Student/Student/Courses/Search?keyword=" +
        data.number
      }
      target="_blank"
    >
      <Card className="p-4" isPressable isHoverable>
        <Text h3>{data.number + " " + data.name}</Text>
        {data.expand?.professor?.map((prof) => (
          <Text h5 color="$gray800">
            {prof.name}
            <Badge
              disableOutline
              variant="flat"
              color="primary"
              size="xs"
              className="ml-2 uppercase"
            >
              <MdStarOutline className="mr-1" />
              {prof.rating > 0 ? prof.rating.toFixed(1) : "unrated"}
            </Badge>
          </Text>
        ))}
      </Card>
    </a>
  );
}
