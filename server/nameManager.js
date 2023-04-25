function match(name1, name2) {
	const name1Info = getNamesArray(name1);
	const name2Info = getNamesArray(name2);
	if (name1Info.last.length == 0) return name2Info.last.includes(name1Info.first) && 2; // If only a last name is provided, check if name2 has the same last name
	if (name2Info.last.length == 0) return name1Info.last.includes(name2Info.first) && 2;
	const lastNamesMatch = pairLastNames(name1Info.last, name2Info.last);
	if (!lastNamesMatch) return 0; // No last name matches
	if (name1Info.first == name2Info.first) return 2; // First names match
	if (name1Info.first.startsWith(name2Info.first)) return 2; // First name initial matches
	if (name2Info.first.startsWith(name1Info.first)) return 2;
	if (name1Info.first.startsWith("b") && name2Info.first.startsWith("w")) return 2; // Bill and Will are interchangable
	if (name1Info.first.startsWith("w") && name2Info.first.startsWith("b")) return 2;
	return 1;
}

function pairLastNames(name1, name2) {
	for (let i = 0; i < name1.length; i++) {
		for (let j = 0; j < name2.length; j++) {
			if (name1[i] == name2[j]) {
				return true;
			}
		}
	}
	return false;
}

function objectify(name) {
	name = name.replace("-", " ") // Replace hyphens with spaces
		.replace("’", "'") // Replace apostrophes with normal ones
		.toLowerCase() // Make everything lowercase
		.replace(/(\w)\.(\w)/g, "$1 $2"); // Replace periods with spaces if they are not initials (St.Germain -> St Germain)
	const nameSplit = name.split(" ");
	const nameInfo = {
		first: nameSplit[0].replace(".", ""), // get rid of period in first initial
		last: nameSplit.slice(1)
	};
	return nameInfo;
}

export default { match, objectify };