import dotenv from "dotenv";
dotenv.config();

import PocketBase from "pocketbase";
import puppeteer from "puppeteer";
import ratings from "@mtucourses/rate-my-professors";
import pLimit from "p-limit";
import browser from "./browser.js";
import nameManager from "./nameManager.js";

const DEBUG_MODE = false;

const cache = {
	professor: {},
	courseName: {},
	matchTime: []
}
const limit = pLimit(8);

const pb = new PocketBase("https://coursehawk-pocketbase.fly.dev");
const admin = await pb.admins.authWithPassword(process.env.PB_EMAIL, process.env.PB_PASSWORD);
const school = await ratings.default.searchSchool("Monmouth University");

run();

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

function debug(...args) {
	if (DEBUG_MODE) {
		console.log(...args);
	}
}

async function matchProfessor(original, course) {
	return new Promise(async (res, rej) => {
		course = course.replace("-", " "); // Courses are formatted as AB 100

		const SHOULD_ADD_QUOTE = original.length < 6 && original.includes(" "); // The cutoff to when a name is considered 'short', ie. (X. Li -> X 'Li')
		// Added %27 to add single quotes around last name. Helps with shorter names.
		const searchQuery = original.replace(". ", "+" + (SHOULD_ADD_QUOTE ? "%27" : ""));
		const [app, page] = await browser.navigate(`https://www.monmouth.edu/directory?s=${searchQuery}${SHOULD_ADD_QUOTE ? "%27" : ""}`);

		const rawResults = await page.$$(".person-name > a"); // Cannot narrow down results, some matches are the 25th result...
		const results = await Promise.all(rawResults.map(async result => {
			const name = await page.evaluate(el => el.textContent, result);
			const link = await page.evaluate(el => el.href, result);
			return { name: name.split(",")[0], link }; // get the name and page link (in case of deep search)
		}));
		const filtered = results.filter(result => {
			result.match = nameManager.match(original, result.name); // Check if the name matches
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
					console.log(`Multiple results found for ${original} after deep search:`, deepMatches);
				}
				app.close();
				if (deepMatches.length == 0 && matchPriority == 2)
					return res(check[0].name); // If there are no matches, cache the original name
				res(deepMatches[0]?.name || null);
				return;
			} else if (check.length == 1) { // If there is only 1 match, use it
				app.close();
				res(check[0].name);
				return;
			} else {
				matchPriority--; // If there are no matches, lower the priority and try again
			}
		}
		// No matches were found, try other last name combinations
		const names = nameManager.objectify(original);
		if (names.last.length > 1) {
			for (let name of names.last) {
				const match = await matchProfessor([names.first, name].join(" "), course, true);
				if (match) {
					app.close();
					res(match);
					return;
				}
			}
		}
		if (original.search(/[a-z][A-Z]/) != -1) { // Try splitting last names if there is a capital letter in the middle (DeJesus -> De Jesus)
			const match = await matchProfessor(original.replace(/([a-z])([A-Z])/g, "$1 $2"), course, true);
			if (match) {
				app.close();
				res(match);
				return;
			}
		}
		// No matches at all. Return null.
		app.close();
		res(null);

		function deepSearch(names) {
			console.log(`Deep searching for ${original}...`);
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
	});
}

async function run() {
	return new Promise(async (res, rej) => {
		let start = Date.now();
		const courses = await getWebCourses();
		console.log("Got web courses in ", timeElapsed(start), " seconds");
		start = Date.now();
		const professors = {};
		await Promise.all(courses.slice(0, 100).map(async (course, index) => {
			return limit(async () => {
				console.log(`Working on ${index}`);
				for (const professor of course.professors) {
					const data = await getProfessorData(professor, course.type);
					if (data) professors[data.name] = data;
				}
			});
		}));
		console.log(professors);
		console.log("Finished in ", timeElapsed(start), " seconds");
		return res();
	});
}

async function getProfessorData(name, course) {
	if (name.toLowerCase().includes("unassign")) return;
	if (cache.professor[name]?.[course]) return;

	cache.professor[name] = cache.professor[name] || {};
	cache.professor[name][course] = true;

	const fullName = await matchProfessor(name, course);
	const data = await getProfessorRatings(fullName);

	return { name: fullName, data };
}
// 		let startTime = Date.now();

// 		const professorIDs = [];
// 		for (const professor of course.professors) {
// 			if (professor.toLowerCase().includes("unassign")) continue; // We don't care about unassigned professors
// 			if (cache.professor[professor]?.[course.type]?.id) {
// 				console.log(i + ". Data for " + professor + " [" + course.number + "] is cached, skipping after ", timeElapsed(startTime), " seconds "
// 					+ (cache.professor[professor][course.type].data ? "✅" : "❔"));
// 				professorIDs.push(cache.professor[professor][course.type].id);
// 				continue;
// 			}
// 			const name = await matchProfessor(professor, course.base);
// 			const matchTime = timeElapsed(startTime); // time the match took in seconds
// 			cache.matchTime.push(matchTime); // push to cache for average later
// 			if (!name) { // If no match was found, log to console and skip
// 				console.log("--------------------- No match for " + professor + " [" + course.number + "] after ", matchTime, " seconds --------------------- ");
// 				if (cache.professor[professor])
// 					cache.professor[professor][course.type] = { data: null };
// 				else
// 					cache.professor[professor] = { [course.type]: { data: null } };
// 				continue;
// 			}
// 			// console.log(i + ". Matched " + professor + " to " + name + " [" + courseNo + "] after ", timeTook, "seconds");
// 			startTime = Date.now(); // change start time in case of two professors. Will be reset at start of loop otherwise
// 			let data = await getProfessorData(name);
// 			if (!data && !name.startsWith(professor.substring(0, 1))) { // If not found but the matched name has a different first initial, try the original initial
// 				data = await getProfessorData([professor.substring(0, 1), name.split(" ", 2)[1]].join(" "));
// 			}
// 			// console.log(data);
// 			const dataTime = timeElapsed(startTime); // time the data took in seconds
// 			console.log(i + ". Matched " + professor + " to " + name + " [" + course.number + "] after ", matchTime, "seconds. "
// 				+ (data ? "D" : "No d") + "ata received for "
// 				+ (data ? [data.firstName, data.lastName].join(" ") : name) + " after ", dataTime, "seconds "
// 			+ (data ? "✅" : "❌"));
// 			// console.log((data ? "D" : "No d") + "ata received after ", (Date.now() - startTime) / 1000, "seconds");
// 			startTime = Date.now();

// 			// save the professor
// 			const insertData = {
// 				name,
// 				legacyId: data?.legacyId || -1,
// 				searchId: data?.id || "",
// 				department: data?.department || "",
// 				rating: data?.avgRating || -1,
// 				numRatings: data?.numRatings || -1,
// 				difficulty: data?.avgDifficulty || -1,
// 				takeAgain: data?.wouldTakeAgainPercent || -1
// 			}
// 			const records = await pb.collection("professors").getFullList({
// 				filter: `legacyId = "${data?.legacyId || 0}"
// 					|| name = "${insertData.name}"`
// 			});
// 			if (records.length > 0) {
// 				if (records[0].legacyId > 0 && !data.legacyId) continue; // If the record is correct but the scraped data is not, don't update
// 				await pb.collection("professors").update(records[0].id, insertData);
// 				console.log(`Updated ${name} with new data ❔`);
// 				professorIDs.push(records[0].id);
// 				continue;
// 			}
// 			const id = (await pb.collection("professors").create(insertData)).id;
// 			professorIDs.push(id);
// 			console.log(`Saved ${name} to record ${id} ✅`);

// 			// cache the professor
// 			if (cache.professor[professor])
// 				cache.professor[professor][course.type] = { name, data, id };
// 			else
// 				cache.professor[professor] = { [course.type]: { name, data, id } };
// 		}
// 		// console.log(courseNo, courseName, professorData, credits, term);

// 		// Save the course
// 		const courseData = {
// 			number: course.number,
// 			professor: professorIDs,
// 			name: course.name,
// 			term: course.term,
// 			credits: course.credits
// 		};
// 		const records = await pb.collection("courses").getFullList({
// 			filter: `number = "${course.number}" && term = "${course.term}"`
// 		});
// 		if (records.length > 0) {
// 			await pb.collection("courses").update(records[0].id, courseData);
// 			console.log(`Updated ${course.number} with new data ❔`);
// 			// continue;
// 		}
// 		const courseID = (await pb.collection("courses").create(courseData)).id;

// 		console.log(`Saved ${course.number} to record ${courseID} ✅`);
// 		console.log("Scrape has completed.");
// 		const totalTime = Math.round(cache.matchTime.reduce((a, b) => a + b, 0) * 100) / 100;
// 		console.log("Average match time: ", Math.round(totalTime / cache.matchTime.length * 100) / 100, "seconds");
// 		console.log("Total match time: ", totalTime, "seconds (", Math.round(totalTime / 60 * 100) / 100, " minutes)");
// 		console.log("Professors without a name match: ", Object.entries(cache.professor).filterMap(entry =>
// 			Object.values(entry[1]).some(type => type.data == null) ? entry[0] : null
// 		));

// 		app.close();
// 	});
// }

function getWebCourses() {
	return new Promise(async (res, rej) => {
		const [app, page] = await browser.navigate("https://www2.monmouth.edu/muwebadv/wa3/search/SearchClassesv2.aspx");

		await page.select("#MainContent_ddlTerm", "23/FA");
		await page.click("#MainContent_btnSubmit");
		await page.waitForNavigation()
			.then(() => console.log("Page has navigated..."))
			.catch(() => {
				console.log("Page failed to navigate, retrying...");
				app.close();
				return getWebCourses();
			});

		const rows = await page.$$("#MainContent_dgdSearchResult tr");
		const courses = await Promise.all(rows.map(async (row, index) => {
			const fields = await row.$$("td");
			const courseInfo = await fields[0].$("span");
			if (!courseInfo) return;
			const courseNumberRaw = await page.evaluate(el => el.innerHTML, courseInfo);
			const courseNumber = courseNumberRaw.split("<br>")[0];
			const courseInfoLink = await parseCourseLinkFromRow(page, fields);
			const json = {
				number: courseNumberRaw.split("<br>")[0],
				base: courseNumber.split("-").slice(0, 2).join("-"),
				type: courseNumber.split("-")[0],
				link: courseInfoLink,
				// name: await parseCourseName(courseInfoLink), // currently crashes computer due to 1500 instances of chrome opening simultaneously
				professors: await parseProfessorsFromRow(page, fields),
				credits: await parseCreditsFromRow(page, fields),
				term: await parseTermFromRow(page, fields),
			};
			return json;
		}));
		courses.splice(0, 1); // The first row is the header

		res(courses);
		app.close();
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

async function getProfessorRatings(name) {
	name = name.replace(/(\s+)[A-Z]\.(\s+)/g, "$1"); // Remove middle initials
	name = name.replace(/\w{2,}\./g, ""); // Remove prefixes (Dr.)
	const original = nameManager.objectify(name); // Keep a copy of the original names array
	function resetName() { // Create a copy of the original names array
		const names = Object.assign({}, original);
		names.last = names.last.filter(n => !n.startsWith("("));
		return names;
	}
	const nameMutations = [
		(names, i) => {
			if (names.last.length == 1) return [names, i];
			names.last = names.last.slice(1); // Remove a last name until there is only 1
			if (names.last.length > 1) i--; // i-- Because there are more last names to remove
			return [names, i];
		},
		(names, i, original) => { // If there is a preferred name (in parentheses), set that as the first name and try last name variations again
			if (names.first != original.first) return [names, i];
			names = resetName();
			const firstNameReplacement = original.last.reduce((prev, curr) => curr.startsWith("(") ? curr.replace(/\((\w+)\)/g, "$1") : prev, names.first);
			if (firstNameReplacement == names.first) return [names, i]; // If there is no preferred name, return
			names.first = firstNameReplacement;
			i = -1;
			return [names, i];
		}
	]
	let names = resetName();
	const professorData = await new Promise(async (res, rej) => {
		let professors;
		for (let currentMutation = 0; currentMutation < nameMutations.length; currentMutation++) {
			const name = names.first + " " + names.last[0];
			professors = await ratings.default.searchTeacher(name, school[0].id).catch(err => console.log(err)); // search the RMP GraphQL API
			if (!professors || professors.length == 0) {
				[names, currentMutation] = nameMutations[currentMutation](names, currentMutation, original); // mutate the name
				if (Object.keys(names).length == 0) break;
				continue;
			}
			break;
		}
		if (!professors || professors.length == 0) return res();
		const professor = (() => {
			for (const professor of professors) {
				if (names.first &&
					!professor.firstName.toLowerCase().startsWith(names.first.toLowerCase().substring(0, 1))) continue; // If there's a first name, check that the initials match
				return professor;
			}
		})();
		if (!professor) return res();
		const data = await ratings.default.getTeacher(professor.id);
		res(data);
	});
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

function parseCourseLinkFromRow(page, row) {
	return new Promise(async (res, rej) => {
		const link = await page.evaluate(cell => cell.querySelector("a").href, row[0]);
		res(link.replace(/javascript:Openpopup\('(.*)%27\)/g, "$1"));
	});
}

function parseCourseName(link) {
	return new Promise(async (res, rej) => {
		function cacheName(name) {
			cache.courseName[link] = name;
		}
		if (cache.courseName[link]) {
			return res(cache.courseName[link]);
		}
		const url = "https://www2.monmouth.edu/muwebadv/wa3/search/" + link;

		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.goto(url);

		const table = await page.$("#dgdCourseDescription");

		if (!table) {
			browser.close();
			cacheName(null);
			return res(null);
		}

		const row = await table.$$("tr");

		if (row.length < 2) {
			browser.close();
			cacheName(null);
			return res(null);
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