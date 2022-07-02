import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    args: ["--disable-setuid-sandbox", "--window-size=1920,1080"],
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.resourceType() === "image") {
      request.abort();
    } else {
      request.continue();
    }
  });
  await page.goto(`https://etherscan.io/address/${process.env.ADDRESS}`);
  await page.screenshot({ path: `screenshots/full-${process.env.ADDRESS}.png`, fullPage: true });

  // Wait for the txns page to load and display the txns.
  const txnsSelector = "a.hash-tag.myFnExpandBox_searchVal";
  await page.waitForSelector(txnsSelector);

  await browser.close();
})();
