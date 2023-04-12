import dotenv from "dotenv";
dotenv.config();

import PocketBase from "pocketbase";
import puppeteer from "puppeteer";
import ratings from "@mtucourses/rate-my-professors";

const pb = new PocketBase("http://127.0.0.1:8090");

const admin = await pb.admins.authWithPassword(process.env.PB_EMAIL, process.env.PB_PASSWORD);

// scrapeWebData();

// console.log(await matchProfessor("C. Yu")); // Works
// console.log(await matchProfessor("M. Yu")); // Works
console.log(await matchProfessor("E. Walsh", "AN-103"));

async function matchProfessor(initials, course) {
	course.replace("-", " ");
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const searchQuery = initials.replace(". ", "+");
	await page.goto(`https://www.monmouth.edu/directory?s=${searchQuery}`);

	const rawResults = await page.$$(".person-name > a");
	const results = await Promise.all(rawResults.map(async result => {
		const name = await page.evaluate(el => el.textContent, result);
		const link = await page.evaluate(el => el.href, result);
		return { name: name.split(",")[0], link };
	}));
	const filtered = results.filter(result => {
		const initialName = initials.replace(".", "").split(" ");
		const resultName = result.name.split(" ");
		if (initialName[1] != resultName[1]) return false;
		if (!resultName[0].startsWith(initialName[0])) return false;
		return true;
	});

	if (filtered.length > 1) {
		console.log("Multiple results found for " + initials);
		for (const result of filtered) {
			await page.goto(result.link);
			const blocks = await page.$$(".wp-block-column");
			blocks.forEach(async block => {
				const match = await page.evaluate(el => el.textContent.includes(course), block);
				console.log("Matched: ", match)
			});
		}
	} else {
		browser.close();
		return filtered[0] || null;
	}
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
		const ITERATIONS = rows.length;
		// const ITERATIONS = 10;
		const updatedProfessors = {};
		for (let i = 1; i < ITERATIONS; i++) {
			const row = rows[i];
			const fields = await row.$$("td");

			const courseCell = await fields[0].$("span");
			const courseRaw = await page.evaluate(el => el.innerHTML, courseCell);
			const courseNo = courseRaw.split("<br>")[0];
			console.log("Scraping data for " + courseNo);

			const courseName = await parseCourseNameFromID(courseNo, courseRaw.split("<br>")[1]);
			const professors = await parseProfessorsFromRow(page, fields);
			const credits = await parseCreditsFromRow(page, fields);
			const term = await parseTermFromRow(page, fields);

			const professorData = [];
			for (const professor of professors) {
				const data = await getProfessorData(professor);
				professorData.push(data);
			}

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

const courseNameCache = {};

function parseCourseNameFromID(id, backup) {
	const raw = id.split("-").slice(0, 2); 	// AB-100-01
	const baseID = raw.join("_"); 					// AB-100
	return new Promise(async (res, rej) => {
		function cacheName(name) {
			courseNameCache[baseID] = name;
		}
		if (courseNameCache[baseID]) {
			return res(courseNameCache[baseID]);
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