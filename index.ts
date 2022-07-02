import * as dotenv from "dotenv";
import puppeteer from "puppeteer";
import fs from "fs";

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

  // Start at first page
  let currPageNum = 1;
  let totalPageNum = 1;

  await page.goto(`https://etherscan.io/txs?a=${process.env.ADDRESS}`);

  // Get total number of pages at the first page
  try {
    totalPageNum = await page.$$eval(`[aria-label="page navigation"] li.page-item`, (btns) => {
      const pageLabelText = btns[2]?.textContent?.split(" ") || "";
      const pageNumber = Number(pageLabelText[pageLabelText?.length - 1]);
      currPageNum = 2;

      return pageNumber;
    });
  } catch (err) {
    console.error(err);
  }

  console.log(`total pages: ${totalPageNum}`);

  // Collect all transaction hashes
  const totalTxnList = [];

  while (currPageNum < totalPageNum + 1) {
    console.log(`On page ${currPageNum}`);

    await page.goto(`https://etherscan.io/txs?a=${process.env.ADDRESS}&p=${currPageNum}`);

    // Wait for the txns page to load and display the txns.
    const txnsList = await page.$$eval(".hash-tag > .myFnExpandBox_searchVal", (rows) =>
      rows.map((el) => el.textContent)
    );
    totalTxnList.push(...txnsList);

    // Increment current page number
    currPageNum++;
  }

  console.log(totalTxnList.join("\n"));

  const spentAmtTxnsList = [];
  // Collect all transaction items;
  const allTxnData = [];
  const currentYearOnly = new Date().getFullYear();
  let isNotCurrentYear = false;

  for (const txn of totalTxnList) {
    try {
      await page.goto(`https://etherscan.io/tx/${txn}`, { waitUntil: "domcontentloaded" });
      console.log("Transaction hash: ", txn);

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

      // Amount paid to the miner for processing the transaction (in ETH)
      const txnEthFee = await page.$eval("#ContentPlaceHolder1_spanTxFee", (ele) =>
        ele.textContent?.split(" ")[0].replace(/[^0-9.]/g, "")
      );
      console.log("Transaction Fee (eth): ", Number(txnEthFee));

      // Cost per unit of gas specified for the transaction (in ETH)
      const gasEthPrice = await page.$eval("#ContentPlaceHolder1_spanGasPrice", (ele) =>
        ele.textContent?.split(" ")[0].replace(/[^0-9.]/g, "")
      );
      console.log("Gas Price (eth): ", Number(gasEthPrice));

      // Closing price of Ether on day of txn
      const ethUSD = await page.$eval("#ContentPlaceHolder1_spanClosingPrice", (ele) =>
        ele.textContent?.split(" ")[0].replace(/[^0-9.]/g, "")
      );
      console.log("Ether Closing USD: ", ethUSD);

      // Fee values in USD
      const txnUsdFee = Number(txnEthFee) * Number(ethUSD);
      const gasUsdFee = Number(gasEthPrice) * Number(ethUSD);
      // Total fees in USD
      const spentAmt = txnUsdFee + gasUsdFee;

      if (!isNotCurrentYear) {
        spentAmtTxnsList.push(spentAmt);
      }

      console.log("Transaction Fee (USD): ", txnUsdFee);
      console.log("Gas Fee (USD): ", gasUsdFee);
      console.log("TOTAL: $", spentAmt);

      const txnHashTrunc = txn?.substring(0, 8);
      const imageFile = `output/screenshots/${addressTrunc}-${txnHashTrunc}.png`;
      await page.screenshot({
        path: imageFile,
        fullPage: true,
      });

      const txnItem = {
        date: date.local,
        spentAmt: Number(spentAmt).toPrecision(3),
        description: `Fee reimbursement for txn: ${txnHashTrunc}`,
        txn,
        txnEthFee: Number(txnEthFee),
        gasEthPrice: Number(gasEthPrice),
        imageFile,
      };

      console.table(txnItem);
      allTxnData.push(txnItem);
      console.log("-----------------------------------");
    } catch (err) {
      console.error(err);
    }
  }

  const totalSpentAmt = spentAmtTxnsList.reduce((prev, curr) => prev + curr, 0);
  console.log("Total Spent Amt: ", totalSpentAmt);

  createCsvFile(allTxnData);

  await browser.close();
})();

function createCsvFile(txnList: any) {
  const headerRow = [
    "Date",
    "Spent Amount",
    "Business Purpose",
    "Transaction Hash",
    "Transaction Fee (ETH)",
    "Gas Fee (ETH)",
  ].join(", ");

  const rows = [headerRow];

  Object.values(txnList).map((value: any) => {
    const row = Object.values(value).join(", ");
    rows.push(row);
  });

  const allRows = rows.join("\n");

  fs.writeFile(`output/${addressTrunc}-reimbursements.csv`, allRows, "utf8", (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(`Data saved to 'output' directory`);
    }
  });
}
