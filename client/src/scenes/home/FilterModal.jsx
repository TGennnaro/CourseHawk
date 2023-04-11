import { Checkbox, Modal, Radio, Row, Text } from "@nextui-org/react";
import React from "react";

export default function FilterModal({ filters, setFilters, open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} closeButton>
      <Modal.Header>
        <Text h3>Search Filters</Text>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4">
        <Row justify="space-between">
          <div>
            <Text h4>Rating</Text>
            <Radio.Group
              aria-label="rating"
              onChange={(value) => setFilters({ ...filters, rating: value })}
              defaultValue={filters.rating}
            >
              <Radio value=">= 2.0"> 2.0 or Higher</Radio>
              <Radio value=">= 3.0"> 3.0 or Higher</Radio>
              <Radio value=">= 4.0"> 4.0 or Higher</Radio>
            </Radio.Group>
          </div>
          <div>
            <Text h4>Difficulty</Text>
            <Radio.Group
              aria-label="difficulty"
              onChange={(value) =>
                setFilters({ ...filters, difficulty: value })
              }
              defaultValue={filters.difficulty}
            >
              <Radio value="<= 4.0"> 4.0 or Lower</Radio>
              <Radio value="<= 3.0"> 3.0 or Lower</Radio>
              <Radio value="<= 2.0"> 2.0 or Lower</Radio>
            </Radio.Group>
          </div>
        </Row>
        <Checkbox
          onChange={(value) => setFilters({ ...filters, unrated: value })}
          defaultSelected={filters.unrated}
        >
          Show unrated professors
        </Checkbox>
      </Modal.Body>
    </Modal>
  );
}
