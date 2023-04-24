import puppeteer from "puppeteer";

let browser;

function navigate(url) {
	return new Promise(async (res, rej) => {
		browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.goto(url);
		await page.waitForNavigation()
			.catch(err => rej(err));
		res(page);
	});
}

function close() {
	browser?.close();
}

async function getAttribute(page, el, attr) {
	return await page.evaluate(element => element[attr], el);
}