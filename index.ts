import * as dotenv from "dotenv";
import puppeteer from "puppeteer";

dotenv.config();

const addressTrunc = `${process.env.ADDRESS}`.substring(0, 8);

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

  // Wait for the txns page to load and display the txns.
  const txnsList = await page.$$eval(".hash-tag.myFnExpandBox_searchVal", (rows) =>
    rows.map((el) => el.textContent)
  );

  console.log(txnsList.join("\n"));

  const spentAmtTxnsList = [];

  const currentYearOnly = new Date().getFullYear();
  let isNotCurrentYear = false;

  for (const txn of txnsList) {
    await page.goto(`https://etherscan.io/tx/${txn}`, { waitUntil: "domcontentloaded" });
    console.log("Transaction number: ", txn);

    // Date of txn
    const date = await page.$eval("#ContentPlaceHolder1_divTimeStamp", (ele) => {
      const spanTextContent = ele.textContent?.match(/(?<=\().*(?=\))/) || [];
      const dateString = spanTextContent[0].split(" ")[0];
      const date = new Date(dateString);

      return {
        year: date.getFullYear(),
        local: date.toLocaleDateString(),
      };
    });

    isNotCurrentYear = date.year !== currentYearOnly;
    if (isNotCurrentYear) {
      console.log(`Exclude ${date.year} Transaction  ...`);
    }
    console.log("Date of txn: ", date);

    const txnEthFee = await page.$eval("#ContentPlaceHolder1_spanTxFee", (ele) =>
      ele.textContent?.split(" ")[0].replace(/[^0-9.]/g, "")
    );
    console.log("Transaction Fee (eth): ", txnEthFee);

    const gasEthPrice = await page.$eval("#ContentPlaceHolder1_spanGasPrice", (ele) =>
      ele.textContent?.split(" ")[0].replace(/[^0-9.]/g, "")
    );
    console.log("Gas Price (eth): ", gasEthPrice);

    // Closing price of Ether on day of txn
    const ethUSD = await page.$eval("#ContentPlaceHolder1_spanClosingPrice", (ele) =>
      ele.textContent?.split(" ")[0].replace(/[^0-9.]/g, "")
    );
    console.log("Ether Closing USD: ", ethUSD);

    const txnUsdFee = Number(txnEthFee) * Number(ethUSD);
    const gasUsdFee = Number(gasEthPrice) * Number(ethUSD);
    const spentAmt = txnUsdFee + gasUsdFee;

    if (!isNotCurrentYear) {
      spentAmtTxnsList.push(spentAmt);
    }

    console.log("Transaction Fee (USD): ", txnUsdFee);
    console.log("Gas Fee (USD): ", gasUsdFee);
    console.log("TOTAL: $", spentAmt);

    const imageFile = `${addressTrunc}-${txn?.substring(0, 8)}`;
    await page.screenshot({
      path: `screenshots/${imageFile}.png`,
      fullPage: true,
    });

    console.log("-----");
  }

  const totalSpentAmt = spentAmtTxnsList.reduce((prev, curr) => prev + curr, 0);
  console.log("Total Spent Amt: ", totalSpentAmt);

  await browser.close();
})();
