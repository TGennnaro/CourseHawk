import dotenv from "dotenv";
dotenv.config();

import PocketBase from "pocketbase";
import puppeteer from "puppeteer";
import ratings from "@mtucourses/rate-my-professors";

const cache = {
	professor: {},
	// professorMatch: {},
	// professorData: {},
	courseName: {},
	matchTime: []
}

// const pb = new PocketBase("http://127.0.0.1:8090");

// const admin = await pb.admins.authWithPassword(process.env.PB_EMAIL, process.env.PB_PASSWORD);

// console.log(await getProfessorData("B Werther-Rosenow"));
// console.log(await getProfessorData("Ke Sansevere"));
// console.log(await getProfessorData("Ad Heinrich"));
// console.log(await getProfessorData("Louis Esposito"));
// console.log(await getProfessorData("Robert Scott III"));
// console.log(await getProfessorData("Patrick L. O'Halloran"));
// console.log(await getProfessorData("Felix De Jesus")); // in rmp as Felix Dejesus
// console.log(await getProfessorData("Dr. Deanna Shoemaker")); // in rmp as Deanna Shoemaker
// console.log(await getProfessorData("Wai Kong (Johnny) Pang")); // in rmp as Wai Kong Pang
// console.log(await getProfessorData("Chiu-Yin (Cathy) Wong")); // in rmp as Cathy Wong
// console.log(await getProfessorData("Carol McArthur-Amedeo")); // in rmp as Carol McArthur
// console.log(await getProfessorData("Elizabeth Gilmartin-Keating")); // in rmp as Elizabeth Gilmartin
// console.log(await getProfessorData("Lynn Kraemer-Siracusa")); // in rmp as Lynn Siracusa
// console.log(await getProfessorData("Jennifer Har")); // in rmp as Lynn Siracusa


scrapeWebData();

Array.prototype.filterMap = function (callback) {
	const result = [];
	for (let i = 0; i < this.length; i++) {
		const value = callback(this[i], i, this);
		if (value) {
			result.push(value);
		}
	}
	return result;
}

function doNamesMatch(name1, name2) {
	const name1Info = getNamesArray(name1);
	const name2Info = getNamesArray(name2);
	if (name1Info.last.length == 0) return name2Info.last.includes(name1Info.first) && 2; // If only a last name is provided, check if name2 has the same last name
	if (name2Info.last.length == 0) return name1Info.last.includes(name2Info.first) && 2;
	const lastNamesMatch = findLastNamePair(name1Info.last, name2Info.last);
	if (!lastNamesMatch) return 0; // No last name matches
	if (name1Info.first == name2Info.first) return 2; // First names match
	if (name1Info.first.startsWith(name2Info.first)) return 2; // First name initial matches
	if (name2Info.first.startsWith(name1Info.first)) return 2;
	if (name1Info.first.startsWith("b") && name2Info.first.startsWith("w")) return 2; // Bill and Will are interchangable
	if (name1Info.first.startsWith("w") && name2Info.first.startsWith("b")) return 2;
	return 1;
}

function findLastNamePair(name1, name2) {
	for (let i = 0; i < name1.length; i++) {
		for (let j = 0; j < name2.length; j++) {
			if (name1[i] == name2[j]) {
				return true;
			}
		}
	}
	return false;
}

function getNamesArray(name) {
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

async function matchProfessor(original, course, noCache = false) {
	return new Promise(async (res, rej) => {
		course = course.replace("-", " "); // Courses are formatted as AB 100

		// Check if the name is cached
		// const cachedName = checkCache();
		// if (cachedName) {
		// 	return res(cachedName);
		// };

		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		const SHOULD_ADD_QUOTE = original.length < 6 && original.includes(" "); // The cutoff to when a name is considered 'short', ie. (X. Li -> X 'Li')
		// Added %27 to add single quotes around last name. Helps with shorter names.
		const searchQuery = original.replace(". ", "+" + (SHOULD_ADD_QUOTE ? "%27" : ""));
		await page.goto(`https://www.monmouth.edu/directory?s=${searchQuery}${SHOULD_ADD_QUOTE ? "%27" : ""}`);

		const rawResults = await page.$$(".person-name > a"); // Cannot narrow down results, some matches are the 25th result...
		const results = await Promise.all(rawResults.map(async result => {
			const name = await page.evaluate(el => el.textContent, result);
			const link = await page.evaluate(el => el.href, result);
			return { name: name.split(",")[0], link }; // get the name and page link (in case of deep search)
		}));
		const filtered = results.filter(result => {
			result.match = doNamesMatch(original, result.name); // Check if the name matches
			return (result.match > 0); // Only get the matches that are either full (2) or partial (1)
		});

		let matchPriority = 2; // Start with highest confidence matches
		while (matchPriority > 0) {
			const check = filtered.filter(result => {
				if (result.match == matchPriority) { // Only check the names that are of the given priority (starts high, gets lower)
					return true;
				}
			});

			if (check.length > 1 || // If there is more than one match, deep search the page for recently taught courses
				(check.length == 1 && matchPriority == 1)) { // If there is only one match, but it is a partial match, deep search the page
				const deepMatches = await deepSearch(check);
				if (deepMatches.length > 1) { // If there are still multiple, take the first but log to console
					console.log("Multiple results found for " + original + " after deep search:", deepMatches);
				}
				browser.close();
				if (deepMatches.length == 0 && matchPriority == 2)
					return res(check[0].name); // If there are no matches, cache the original name
				res(deepMatches[0]?.name || null);
				return;
			} else if (check.length == 1) { // If there is only 1 match, use it
				browser.close();
				res(check[0].name);
				return;
			} else {
				matchPriority--; // If there are no matches, lower the priority and try again
			}
		}
		// No matches were found, try other last name combinations
		const names = getNamesArray(original);
		if (names.last.length > 1) {
			for (let name of names.last) {
				const match = await matchProfessor([names.first, name].join(" "), course, true);
				if (match) {
					browser.close();
					res(match);
					return;
				}
			}
		}
		if (original.search(/[a-z][A-Z]/) != -1) { // Try splitting last names if there is a capital letter in the middle (DeJesus -> De Jesus)
			const match = await matchProfessor(original.replace(/([a-z])([A-Z])/g, "$1 $2"), course, true);
			if (match) {
				browser.close();
				res(match);
				return;
			}
		}
		// No matches at all. Return null.
		browser.close();
		res(null);;

		function deepSearch(names) {
			console.log("Deep searching for " + original + "...");
			return new Promise(async (res, rej) => {
				const deepMatches = [];
				for (const result of names) {
					await page.goto(result.link); // Open their page and parse the data
					const blocks = await page.$$(".wp-block-column");
					await Promise.all(blocks.map(async block => {
						const textContent = await page.evaluate(el => el.textContent, block);
						// Check if the given course is in the block
						if (textContent.includes(course) && !deepMatches.includes(result)) deepMatches.push(result);
					}));
				}
				res(deepMatches);
			});
		}
		function checkCache() {
			const courseType = course.split(" ")[0];
			// Check if the name is cached already
			return cache.professorMatch[original]?.[courseType];
		}
	});
}

async function scrapeWebData() {
	return new Promise(async (res, rej) => {
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.goto("https://www2.monmouth.edu/muwebadv/wa3/search/SearchClassesv2.aspx");

		await page.select("#MainContent_ddlTerm", "23/FA");

		await page.click("#MainContent_btnSubmit");

		await page.waitForNavigation()
			.then(() => console.log("Page has navigated..."))
			.catch(() => {
				console.log("Page failed to navigate, retrying...");
				browser.close();
				return scrapeWebData();
			});

		const rows = await page.$$("#MainContent_dgdSearchResult tr");
		const START = 1; // default: 1
		const ITERATIONS = rows.length;
		const updatedProfessors = {};
		console.log("Scraping data for " + (ITERATIONS - START) + " courses...");
		for (let i = START; i < ITERATIONS; i++) {
			let startTime = Date.now();
			const row = rows[i];
			const fields = await row.$$("td");

			const courseCell = await fields[0].$("span");
			const courseRaw = await page.evaluate(el => el.innerHTML, courseCell);
			const courseNo = courseRaw.split("<br>")[0];
			const courseBase = courseNo.split("-").slice(0, 2).join("-");
			const courseType = courseNo.split("-")[0];

			const courseName = await parseCourseNameFromID(courseNo, courseRaw.split("<br>")[1]);
			const professors = await parseProfessorsFromRow(page, fields);
			const credits = await parseCreditsFromRow(page, fields);
			const term = await parseTermFromRow(page, fields);

			// const professorData = [];
			for (const professor of professors) {
				if (professor.toLowerCase().includes("unassign")) continue; // We don't care about unassigned professors
				if (cache.professor[professor]?.[courseType]) {
					console.log(i + ". Data for " + professor + " [" + courseNo + "] is cached, skipping after ", timeElapsed(startTime), " seconds "
						+ (cache.professor[professor][courseType].data ? "✅" : "❔"));
					continue;
				}
				const name = await matchProfessor(professor, courseBase);
				const matchTime = timeElapsed(startTime); // time the match took in seconds
				cache.matchTime.push(matchTime); // push to cache for average later
				if (!name) { // If no match was found, log to console and skip
					console.log("--------------------- No match for " + professor + " [" + courseNo + "] after ", matchTime, " seconds --------------------- ");
					if (cache.professor[professor])
						cache.professor[professor][courseType] = { data: null };
					else
						cache.professor[professor] = { [courseType]: { data: null } };
					continue;
				}
				// console.log(i + ". Matched " + professor + " to " + name + " [" + courseNo + "] after ", timeTook, "seconds");
				startTime = Date.now(); // change start time in case of two professors. Will be reset at start of loop otherwise
				let data = await getProfessorData(name);
				if (!data && !name.startsWith(professor.substring(0, 1))) { // If not found but the matched name has a different first initial, try the original initial
					data = await getProfessorData([professor.substring(0, 1), name.split(" ", 2)[1]].join(" "));
				}
				// console.log(data);
				const dataTime = timeElapsed(startTime); // time the data took in seconds
				console.log(i + ". Matched " + professor + " to " + name + " [" + courseNo + "] after ", matchTime, "seconds. "
					+ (data ? "D" : "No d") + "ata received for "
					+ (data ? [data.firstName, data.lastName].join(" ") : name) + " after ", dataTime, "seconds "
				+ (data ? "✅" : "❌"));
				// console.log((data ? "D" : "No d") + "ata received after ", (Date.now() - startTime) / 1000, "seconds");
				startTime = Date.now();
				// save professor
				if (cache.professor[professor])
					cache.professor[professor][courseType] = { name, data };
				else
					cache.professor[professor] = { [courseType]: { name, data } };
			}
			continue;

			// console.log(courseNo, courseName, professorData, credits, term);

			// Save the professor data to get recordID
			for (const data of professorData) {
				const name = data.firstName + " " + data.lastName;
				if (updatedProfessors[name]) continue;
				const recordID = await saveProfessor(data);
				updatedProfessors[name] = recordID;
			}

			// Save the course
			const courseData = {
				number: courseNo,
				professor: professorData.map(data => updatedProfessors[data.firstName + " " + data.lastName]),
				name: courseName,
				term,
				credits
			}
			const records = await pb.collection("classes").getFullList({
				filter: `number = "${courseNo}" && term = "${term}"`
			});
			if (records.length > 0) {
				await pb.collection("classes").update(records[0].id, courseData);
				continue;
			}
			await pb.collection("classes").create(courseData);

			console.log("Saved " + courseNo);
		}
		console.log("Scrape has completed.");
		const totalTime = Math.round(cache.matchTime.reduce((a, b) => a + b, 0) * 100) / 100;
		console.log("Average match time: ", Math.round(totalTime / cache.matchTime.length * 100) / 100, "seconds");
		console.log("Total match time: ", totalTime, "seconds (", Math.round(totalTime / 60 * 100) / 100, " minutes)");
		console.log("Professors without a name match: ", Object.entries(cache.professor).filterMap(entry =>
			Object.values(entry[1]).some(type => type.data == null) ? entry[0] : null
		));

		browser.close();
	});
}

function saveProfessor(data) {
	return new Promise(async (res, rej) => {
		const formattedData = {
			name: data.firstName + " " + data.lastName,
			legacyId: data.legacyId || -1,
			searchId: data.id,
			department: data.department,
			rating: data.avgRating || -1,
			numRatings: data.numRatings || -1,
			difficulty: data.avgDifficulty || -1,
			takeAgain: data.wouldTakeAgainPercent || -1
		};
		const records = await pb.collection("professors").getFullList({
			filter: `legacyId = "${data.legacyId || 0}"
			|| name = "${formattedData.name}"
			|| name = "${data.firstName.substring(0, 1) + ". " + data.lastName}"
			|| name = "${data.lastName}"
			|| name ~ "${data.lastName}"` // To match correct record with incorrect professor so we can continue later on
		});
		if (records.length > 0) {
			if (records[0].legacyId > 0 && !data.legacyId) return res(); // If the record is correct but the scraped data is not, don't update
			return res((await pb.collection("professors").update(records[0].id, formattedData)).id);
		}
		res((await pb.collection("professors").create(formattedData)).id);
	});
}

async function getProfessorData(name) {
	function resetName(nameObj) {
		const names = Object.assign({}, nameObj);
		names.last = names.last.filter(n => !n.startsWith("("));
		return names;
	}
	const nameMutations = [
		(names, i) => {
			names.last = names.last.slice(1);
			if (names.last.length > 1) i--;
			return [names, i];
		},
		(names, i, original) => {
			if (names.first != original.first) return [names, i];
			names = resetName(original);
			const firstNameReplacement = original.last.reduce((prev, curr) => curr.startsWith("(") ? curr.replace(/\((\w+)\)/g, "$1") : prev, "");
			names.first = firstNameReplacement;
			i = -1;
			return [names, i];
		}
	]
	// if (cache.professorData[name]) return cache.professorData[name];
	// console.log(name)
	name = name.replace(/(\s+)[A-Z]\.(\s+)/g, "$1"); // Remove middle initials
	name = name.replace(/\w{2,}\./g, ""); // Remove prefixes
	const original = getNamesArray(name);
	let names = resetName(original);
	// console.log(names);
	const professorData = await new Promise(async (res, rej) => {
		const school = await ratings.default.searchSchool("Monmouth University");
		// console.log("Searching " + name);
		let teachers;
		for (let i = 0; i < nameMutations.length; i++) {
			const name = names.first + " " + names.last[0];
			// console.log("Searching ", name);
			teachers = await ratings.default.searchTeacher(name, school[0].id).catch(err => console.log(err));
			if (!teachers || teachers.length == 0) {
				[names, i] = nameMutations[i](names, i, original);
				continue;
			}
			// console.log(teachers);
			break;
		}
		if (!teachers || teachers.length == 0) return res();
		const teacherID = (() => {
			for (const teacher of teachers) {
				// console.log(teacher)
				if (teacher.school.name != "Monmouth University") continue;
				// if (firstName && !teacher.firstName.startsWith(firstName.substring(0, 1))) continue; // If there's a first name, check that the initials match
				return teacher;
			}
		})();
		if (!teacherID) return res();
		// console.log("Matched " + firstName + " " + (lastName || "") + " with " + teacherID.firstName + " " + teacherID.lastName);
		const data = await ratings.default.getTeacher(teacherID.id);
		res(data);
	});
	// cache.professorData[name] = professorData;
	return professorData;
}

function parseProfessorsFromRow(page, row) {
	return new Promise(async (res, rej) => {
		const professor = await page.evaluate(cell => cell.innerHTML, row[2]);
		const names = professor.split("<br>");
		if (names.length > 1 && names[0] == names[1]) names.pop();
		for (const name of names) {
			if (name.toLowerCase().includes("unassign")) {
				names.splice(names.indexOf(name), 1);
			}
		}
		res(names);
	});
}

function parseCreditsFromRow(page, row) {
	return new Promise(async (res, rej) => {
		const credits = await page.evaluate(cell => cell.textContent, row[4]);
		res(parseInt(credits));
	});
}

function parseTermFromRow(page, row) {
	return new Promise(async (res, rej) => {
		const term = await page.evaluate(cell => cell.textContent, row[8]);
		res(term);
	});
}

function parseCourseNameFromID(id, backup) {
	const raw = id.split("-").slice(0, 2); 	// AB-100-01
	const baseID = raw.join("_"); 					// AB-100
	return new Promise(async (res, rej) => {
		function cacheName(name) {
			cache.courseName[baseID] = name;
		}
		if (cache.courseName[baseID]) {
			return res(cache.courseName[baseID]);
		}
		const url = "https://www2.monmouth.edu/muwebadv/wa3/search/CourseDescV2.aspx?Id=" + baseID;

		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.goto(url);

		const table = await page.$("#dgdCourseDescription");

		if (!table) {
			browser.close();
			cacheName(backup)
			return res(backup);
		}

		const row = await table.$$("tr");

		if (row.length < 2) {
			browser.close();
			cacheName(backup)
			return res(backup);
		}

		const cells = await row[1].$$("td");
		const name = await page.evaluate(cell => cell.textContent, cells[1]);

		browser.close();
		cacheName(name);
		res(name);
	});
}

function timeElapsed(startTime) {
	return Math.round((Date.now() - startTime) / 1000 * 100) / 100;
}