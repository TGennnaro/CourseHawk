import dotenv from "dotenv";
dotenv.config();

import PocketBase from "pocketbase";
import puppeteer from "puppeteer";
import ratings from "@mtucourses/rate-my-professors";

const cache = {
	professorMatch: {},
	courseName: {},
	matchTime: []
}

// const pb = new PocketBase("http://127.0.0.1:8090");

// const admin = await pb.admins.authWithPassword(process.env.PB_EMAIL, process.env.PB_PASSWORD);

scrapeWebData();

// console.log(await matchProfessor("C. Yu")); // Works
// console.log(await matchProfessor("M. Yu")); // Works
// console.log(await matchProfessor("E. Walsh", "AN-103"));
// console.log(await matchProfessor("W. Attardi", "BK-459"));
// console.log(await matchProfessor("F. DeJesus", "BM-471-02"));
// console.log(await matchProfessor("X. Li", "BA-251-01"));

// console.log(doNamesMatch("E. Walsh", "Eileen Walsh"));
// console.log(doNamesMatch("G. Eckert", "Gil Eckert"));
// console.log(doNamesMatch("P. O'Halloran", "Patrick O'Halloran"));
// console.log(doNamesMatch("W. Attardi", "Bill Attardi"));
// console.log(doNamesMatch("O. McKay", "Orin McKay Jr."));
// console.log(doNamesMatch("O. McKay", "Patrick McKay Jr."));
// console.log(doNamesMatch("K. Harney Furgason", "Kelly Furgason"));
// console.log(doNamesMatch("L. Allocco", "Lisa Allocco Russo"));
// console.log(doNamesMatch("Lionetti", "Kathryn Lionetti"));

function doNamesMatch(name1, name2) {
	const name1Info = getNamesArray(name1);
	const name2Info = getNamesArray(name2);
	if (name1Info.last.length == 0) return name2Info.last.includes(name1Info.first) && 2; // If only a last name is provided, check if name2 has the same last name
	if (name2Info.last.length == 0) return name1Info.last.includes(name2Info.first) && 2;
	const lastNamesMatch = findLastNamePair(name1Info.last, name2Info.last);
	// console.log(name1Info.last, lastNamesMatch)
	if (!lastNamesMatch) return 0;
	if (name1Info.first == name2Info.first) return 2;
	// console.log(name1Info.first, name2Info.first)
	if (name1Info.first.startsWith(name2Info.first)) return 2;
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
		.replace(/([a-z])([A-Z])/g, "$1 $2") // Add spaces between last name segments (DeJesus -> De Jesus)
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
		const cachedName = checkCache();
		if (cachedName) {
			return res(cachedName);
		};

		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		const SHORT_NAME_CUTOFF = 6; // The cutoff to when a name is considered 'short', ie. (X. Li -> X 'Li')
		// Added %27 to add single quotes around last name. Helps with shorter names.
		const searchQuery = original.replace(". ", "+" + (original.length < SHORT_NAME_CUTOFF ? "%27" : "")).replace(/([a-z])([A-Z])/g, "$1+$2"); // Replace space with + for URL
		await page.goto(`https://www.monmouth.edu/directory?s=${searchQuery}${original.length < SHORT_NAME_CUTOFF ? "%27" : ""}`);

		const rawResults = await page.$$(".person-name > a"); // Cannot narrow down results, some matches are the 25th result...
		const results = await Promise.all(rawResults.map(async result => {
			const name = await page.evaluate(el => el.textContent, result);
			const link = await page.evaluate(el => el.href, result);
			return { name: name.split(",")[0], link }; // get the name and page link (in case of deep search)
		}));
		// console.log("Got " + results.length + " results for " + original)
		const filtered = results.filter(result => {
			result.match = doNamesMatch(original, result.name); // Check if the name matches
			return (result.match > 0); // Only get the matches that are either full (2) or partial (1)
		});

		let matchPriority = 2;
		while (matchPriority > 0) {
			const check = filtered.filter(result => {
				if (result.match == matchPriority) { // Only check the names that are of the given priority (starts high, gets lower)
					return true;
				}
			});

			if (check.length > 1 || (check.length == 1 && matchPriority == 1)) { // If there is more than one match, deep search the page for recently taught courses
				const deepMatches = await deepSearch(check);
				if (deepMatches.length > 1) { // If there are still multiple, take the first but log to console
					console.log("Multiple results found for " + original + " after deep search:", deepMatches);
				}
				browser.close();
				if (deepMatches.length == 0 && matchPriority == 2)
					return cacheName(check[0].name); // If there are no matches, cache the original name
				cacheName(deepMatches[0]?.name || null);
				return;
			} else if (check.length == 1) { // If there is only 1 match, use it
				browser.close();
				cacheName(check[0].name);
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
					cacheName(match);
					return;
				}
			}
		}
		// No matches at all. Return null.
		browser.close();
		cacheName(null);

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
		function cacheName(matched) {
			if (noCache) return res(matched);
			const courseType = course.split(" ")[0];
			// Cache professor name and course type, in case multiple professors with same initial from different departments
			if (cache.professorMatch[original]) {
				// Push course type if not already in array
				if (!cache.professorMatch[original].courseTypes.includes(courseType)) {
					cache.professorMatch[original].courseTypes.push(courseType);
				}
			} else {
				cache.professorMatch[original] = {
					name: matched,
					courseTypes: [courseType]
				}
			}
			res(matched);
		}
		function checkCache() {
			const courseType = course.split(" ")[0];
			// Check if the name is cached already
			if (cache.professorMatch[original]) {
				if (cache.professorMatch[original].courseTypes.includes(courseType)) {
					return cache.professorMatch[original].name;
				}
			}
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
			// console.log("Scraping data for " + courseNo);

			const courseName = await parseCourseNameFromID(courseNo, courseRaw.split("<br>")[1]);
			const professors = await parseProfessorsFromRow(page, fields);
			const credits = await parseCreditsFromRow(page, fields);
			const term = await parseTermFromRow(page, fields);

			const professorData = [];
			for (const professor of professors) {
				if (professor.toLowerCase().includes("unassign")) continue; // We don't care about unassigned professors
				const name = await matchProfessor(professor, courseBase);
				const timeTook = (Date.now() - startTime) / 1000; // time the match took in seconds
				cache.matchTime.push(timeTook); // push to cache for average later
				if (!name) { // If no match was found, log to console and skip
					console.log("--------------------- No match for " + professor + " [" + courseNo + "] after ", timeTook, " seconds --------------------- ");
					continue;
				}
				console.log(i + ". Matched " + professor + " to " + name + " [" + courseNo + "] after ", timeTook, "seconds");
				startTime = Date.now(); // change start time in case of two professors. Will be reset at start of loop otherwise
				// professorData.push(data);
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
		console.log("Professors without a name match: ", Object.entries(cache.professorMatch).filter(entry => { if (entry[1].name === null) return entry[0] }));

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

const professorCache = {};

async function getProfessorData(name) {
	if (professorCache[name]) return professorCache[name];
	const nameSplit = name.split(" ");
	const firstName = nameSplit.length > 1 ? nameSplit[0] : null;
	const lastName = nameSplit[1] || nameSplit[0];
	const defaultReturn = { firstName: firstName || "", lastName }; // If professor name is just last name, ensure firstName is ""
	const professorData = await new Promise(async (res, rej) => {
		const school = await ratings.default.searchSchool("Monmouth University");
		const teachers = await ratings.default.searchTeacher(lastName, school[0].id);
		if (!teachers || teachers.length == 0) return res(defaultReturn);
		const teacherID = (() => {
			for (const teacher of teachers) {
				if (teacher.school.name != "Monmouth University") continue;
				if (firstName && !teacher.firstName.startsWith(firstName.substring(0, 1))) continue; // If there's a first name, check that the initials match
				return teacher;
			}
		})();
		if (!teacherID) return res(defaultReturn);
		// console.log("Matched " + firstName + " " + (lastName || "") + " with " + teacherID.firstName + " " + teacherID.lastName);
		const data = await ratings.default.getTeacher(teacherID.id);
		res(data);
	});
	professorCache[name] = professorData;
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