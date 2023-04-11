import { Dropdown, Text } from "@nextui-org/react";

export default function FilterDropdown({
  label,
  filterKey,
  options,
  filter,
  setFilter,
}) {
  return (
    <div>
      <Text size="$xs" color="$gray700" b>
        {label}
      </Text>
      <Dropdown>
        <Dropdown.Button flat>
          {options[filter[filterKey]] || label}
        </Dropdown.Button>
        <Dropdown.Menu
          selectionMode="single"
          selectedKeys={[filter[filterKey]]}
          onSelectionChange={(value) => {
            setFilter({
              ...filter,
              [filterKey]: value.currentKey,
            });
          }}
        >
          {Object.entries(options).map(([key, value]) => {
            return <Dropdown.Item key={key}>{value}</Dropdown.Item>;
          })}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
