import dotenv from "dotenv";
dotenv.config();

import PocketBase from "pocketbase";
import puppeteer from "puppeteer";
import ratings from "@mtucourses/rate-my-professors";

const pb = new PocketBase("http://127.0.0.1:8090");

const admin = await pb.admins.authWithPassword(process.env.PB_EMAIL, process.env.PB_PASSWORD);

// updateDataset();

const course = await pb.collection("classes").getFullList({
	expand: "professor"
});
console.log(course[1].expand);

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
				scrapeProfessors(); // this doesn't work
			});

		const rows = await page.$$("#MainContent_dgdSearchResult tr");
		const ITERATIONS = 10;
		for (let i = 0; i < ITERATIONS; i++) {
			const row = rows[i];
			const fields = await row.$$("td");

			const courseCell = await fields[0].$("span");
			const courseRaw = await page.evaluate(el => el.innerHTML, courseCell);
			const courseNo = courseRaw.split("<br>")[0];
			const courseName = courseRaw.split("<br>")[1];
			const professors = await parseProfessorsFromRow(page, fields);
			const credits = await parseCreditsFromRow(page, fields);
			const term = await parseTermFromRow(page, fields);
		}
	});
}

// async function updateDataset() {
// const professors = await scrapeProfessors();
// for (const professor of professors) {
// 	const data = {
// 		name: professor.firstName + " " + professor.lastName,
// 		legacyId: professor.legacyId || -1,
// 		searchId: professor.id,
// 		department: professor.department,
// 		rating: professor.avgRating || -1,
// 		numRatings: professor.numRatings || -1,
// 		difficulty: professor.avgDifficulty || -1,
// 		takeAgain: professor.wouldTakeAgainPercent || -1
// 	}
// 	const records = await pb.collection("professors").getFullList({
// 		filter: `legacyId = "${professor.legacyId || 0}"
// 		|| name = "${data.name}"
// 		|| name = "${professor.firstName.substring(0, 1) + ". " + professor.lastName}"
// 		|| name = "${professor.lastName}"
// 		|| name ~ "${professor.lastName}"` // To match correct record with incorrect professor so we can continue later on
// 	});
// 	console.log("Updating " + data.name + ",", professor.legacyId)
// 	if (records.length > 0) {
// 		if (records[0].legacyId > 0 && !professor.legacyId) continue; // If the record is correct but the scraped data is not, don't update
// 		await pb.collection("professors").update(records[0].id, data);
// 		continue;
// 	}
// 	await pb.collection("professors").create(data);
// }

// 	const professorIDCache = {};
// 	const courses = await scrapeCourses();
// 	for (const course of courses) {
// 		const professorData = await (async () => {
// 			if (professorIDCache[course.professor.firstName + " " + course.professor.lastName]) return professorIDCache[course.professor.firstName + " " + course.professor.lastName];
// 			const professorRecord = await pb.collection("professors").getFullList({
// 				filter: `legacyId = "${course.professor.legacyId || 0}"
// 				|| name = "${course.professor.firstName + " " + course.professor.lastName}"`
// 			});
// 			if (professorRecord.length > 0) {
// 				professorIDCache[course.professor.firstName + " " + course.professor.lastName] = professorRecord[0];
// 				return professorRecord[0];
// 			}
// 		})();
// 		if (professorData.length == 0) {
// 			console.log("No professor found for " + course.name + " " + course.number);
// 		}
// 		const data = {
// 			number: course.id,
// 			name: course.name,
// 			professor: professorData[0].id,
// 			term: course.term,
// 			credits: course.credits,
// 		}
// 		const records = await pb.collection("courses").getFullList({
// 			filter: `number = "${data.number}"`
// 		});
// 		console.log("Updating " + data.number)
// 		if (records.length > 0) {
// 			await pb.collection("courses").update(records[0].id, data);
// 			continue;
// 		}
// 		await pb.collection("courses").create(data);
// 	}
// }

async function scrapeProfessors() {
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
				scrapeProfessors(); // this doesn't work
			});

		const rows = await page.$$("#MainContent_dgdSearchResult tr");
		const professors = new Set();
		const professorData = [];
		// for (let i = 1; i < rows.length; i++) {
		for (let i = 1; i < 30; i++) {
			const row = rows[i];
			const cells = await row.$$("td");
			const professor = await page.evaluate(cell => cell.innerHTML, cells[2]);
			console.log("Found ", professor)

			let names = []; // Array because there may be two professors per class
			const matches = professor.matchAll(/(.*)<br>(.*)/g);
			if (matches.length > 0) {
				names.push(matches[0][1]); // push name 1
				if (matches[0][1] != matches[0][2]) { // name 1 does not match name 2
					names.push(matches[0][2]); // push name 2
				}
			} else {
				names.push(professor);
			}

			for (let name of names) {
				if (professors.has(name)) continue;
				if (name.toLowerCase().includes("unassign")) continue;
				const data = await getProfessorData(name);
				professorData.push(data);
				professors.add(name);
			}
		}

		browser.close();

		res(professorData);
	});
}

function getProfessorData(name) {
	const nameSplit = name.split(" ");
	const firstName = nameSplit.length > 1 ? nameSplit[0] : null;
	const lastName = nameSplit[1] || nameSplit[0];
	const defaultReturn = { firstName: firstName || "", lastName }; // If professor name is just last name, ensure firstName is ""
	return new Promise(async (res, rej) => {
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
		console.log("Matched " + firstName + " " + (lastName || "") + " with " + teacherID.firstName + " " + teacherID.lastName);
		const data = await ratings.default.getTeacher(teacherID.id);
		res(data);
	});
}

const courseProfessorCache = {};

function scrapeCourses() {
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
				scrapeCourses(); // this doesn't work
			});

		const rows = await page.$$("#MainContent_dgdSearchResult tr");
		const courses = [];
		for (let i = 1; i < 10; i++) {
			const row = rows[i];
			const cells = await row.$$("td");
			const courseCell = await cells[0].$("span");
			const courseRaw = await page.evaluate(cell => cell.innerHTML, courseCell);
			const id = courseRaw.split("<br>")[0];
			const backupName = courseRaw.split("<br>")[1];
			const name = await parseCourseNameFromID(id, backupName);
			const credits = await parseCreditsFromRow(page, cells);
			const term = await parseTermFromRow(page, cells);
			const professorName = await page.evaluate(cell => cell.innerHTML, cells[2]);
			const professor = await (async () => {
				if (courseProfessorCache[professorName]) return courseProfessorCache[professorName];
				const data = await getProfessorData(professorName);
				courseProfessorCache[professorName] = data;
				return data;
			})();
			const course = { id, name, professor, credits, term };
			courses.push(course);
		}

		browser.close();
		res(courses);
	});
}

function parseProfessorsFromRow(page, row) {
	return new Promise(async (res, rej) => {
		const professor = await page.evaluate(cell => cell.innerHTML, row[2]);
		let names = []; // Array because there may be two professors per class
		const matches = professor.matchAll(/(.*)<br>(.*)/g);
		if (matches.length > 0) {
			names.push(matches[0][1]); // push name 1
			if (matches[0][1] != matches[0][2]) { // name 1 does not match name 2
				names.push(matches[0][2]); // push name 2
			}
		} else {
			names.push(professor);
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

// scrapeCourses();

// const name = await parseCourseNameFromID("AN-103-01");
// console.log(name);

// const school = await ratings.default.searchSchool("Monmouth University");
// console.log(await ratings.default.searchTeacher("Holmes", school[0].id))