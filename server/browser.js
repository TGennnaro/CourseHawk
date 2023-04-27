import puppeteer from "puppeteer";

const MAX_RETRIES = 3;
const HEADLESS = false;

function navigate(url, retries = 0) {
	return new Promise(async (res, rej) => {
		const browser = await puppeteer.launch({ headless: HEADLESS });
		const page = await browser.newPage();
		await page.goto(url);
		res([browser, page]);
	});
}

export default { navigate };