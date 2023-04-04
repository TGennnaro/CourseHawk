import dotenv from "dotenv";
dotenv.config();

import PocketBase from "pocketbase";
import puppeteer from "puppeteer";
import ratings from "@mtucourses/rate-my-professors";

const pb = new PocketBase("http://127.0.0.1:8090");

// const admin = await pb.admins.authWithPassword(process.env.PB_EMAIL, process.env.PB_PASSWORD);

updateDataset();

async function updateDataset() {
	const professors = await scrapeProfessors();
	for (const professor of professors) {
		const data = {
			name: professor.firstName + " " + professor.lastName,
			legacyId: professor.legacyId || -1,
			searchId: professor.id,
			department: professor.department,
			rating: professor.avgRating || -1,
			numRatings: professor.numRatings || -1,
			difficulty: professor.avgDifficulty || -1,
			takeAgain: professor.wouldTakeAgainPercent || -1
		}
		const records = await pb.collection("professors").getFullList({
			filter: `legacyId = "${professor.legacyId || 0}"
			|| name = "${data.name}"
			|| name = "${professor.firstName.substring(0, 1) + ". " + professor.lastName}"
			|| name = "${professor.lastName}"
			|| name ~ "${professor.lastName}"` // To match correct record with incorrect professor so we can continue later on
		});
		console.log("Updating " + data.name + ",", professor.legacyId)
		if (records.length > 0) {
			if (records[0].legacyId > 0 && !professor.legacyId) continue; // If the record is correct but the scraped data is not, don't update
			await pb.collection("professors").update(records[0].id, data);
			continue;
		}
		await pb.collection("professors").create(data);
	}
}

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

// const school = await ratings.default.searchSchool("Monmouth University");
// console.log(await ratings.default.searchTeacher("Holmes", school[0].id))