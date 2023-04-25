import puppeteer from "puppeteer";

const MAX_RETRIES = 3;

function navigate(url, retries = 0) {
	return new Promise(async (res, rej) => {
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.goto(url);
		// await page.waitForNavigation()
		// 	.catch(err => {
		// 		if (retries <= MAX_RETRIES) {
		// 			retries++;
		// 			console.log("Failed navigation, retrying...");
		// 			navigate(url, retries);
		// 		} else {
		// 			rej(err);
		// 		}
		// 	});
		res([browser, page]);
	});
}

export default { navigate, getAttribute };