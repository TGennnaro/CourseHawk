"use client";

import { Button, Card, Modal, Row, Text, useTheme } from "@nextui-org/react";
import { useState } from "react";

export default function RatingCard({ data }) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Card isPressable isHoverable onPress={() => setVisible(true)}>
        <div className="flex">
          <div
            className="grid place-content-center w-32"
            style={{ backgroundColor: theme.colors.primary.value }}
          >
            {data.rating > 0 ? (
              <Text h1 className="m-6">
                {data.rating?.toFixed(1)}
              </Text>
            ) : (
              <Text className="m-6 text-4xl font-bold">N/A</Text>
            )}
          </div>
          <div className="flex flex-col align-center p-4">
            <Text h3>{data.name}</Text>
            <Text h5 color="$gray800">
              {data.department || "N/A"}
            </Text>
          </div>
        </div>
      </Card>
      <Modal
        closeButton
        open={visible}
        onClose={() => setVisible(false)}
        aria-labelledby={data.name}
      >
        <Modal.Header>
          <Text h3>Ratings for {data.name}</Text>
        </Modal.Header>
        <Modal.Body>
          <div className="flex flex-col text-center">
            <Text h1 css={{ marginBottom: 0 }}>
              {data.rating > 0 ? data.rating?.toFixed(1) : "N/A"}
            </Text>
            <Text h5 color="$gray800">
              Based on {Math.max(data.numRatings, 0)} rating
              {data.numRatings > 1 ? "s" : ""}
            </Text>
            <Row justify="space-between" className="mt-4">
              <div>
                <Text h3 css={{ marginBottom: 0 }}>
                  {data.takeAgain > 0
                    ? Math.round(data.takeAgain) + "%"
                    : "N/A"}
                </Text>
                <Text h5 color="$gray800">
                  Would take again
                </Text>
              </div>
              <div>
                <Text h3 css={{ marginBottom: 0 }}>
                  {data.difficulty > 0 ? data.difficulty?.toFixed(1) : "N/A"}
                </Text>
                <Text h5 color="$gray800">
                  Difficulty
                </Text>
              </div>
            </Row>
            {data.legacyId > 0 ? (
              <a
                href={
                  "https://www.ratemyprofessors.com/professor/" + data.legacyId
                }
                target="_blank"
                className="mt-8"
              >
                <Button className="w-full">
                  View on RateMyProfessors' page
                </Button>
              </a>
            ) : (
              <></>
            )}
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
