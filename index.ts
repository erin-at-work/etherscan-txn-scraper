import puppeteer from "puppeteer";
import fs from "fs";
import {
  ADDRESS_TRUNC,
  ARTIFACTS_DIR,
  ETHERSCAN_BY_ADDRESS,
  ETHERSCAN_BY_TXN,
  INPUT_TXT,
  OUTPUT_DIR,
  OUTPUT_FILE_NAME,
} from "./src/constants";

let isFile = false;

// Collect all transaction hashes
const totalTxnList = [];

if (fs.existsSync(INPUT_TXT)) {
  isFile = true;
}
const fileName = isFile ? OUTPUT_FILE_NAME : ADDRESS_TRUNC;

fs.readFile(INPUT_TXT, "utf8", function (err, data) {
  if (err) {
    console.error(err);
    console.log("Check yo self, before you wreck yo'self");

    return;
  }
  // TODO: Validate each txn
  const txnLines = data.split("\n").filter(Boolean);
  totalTxnList.push(...txnLines);
  console.log(txnLines);
});

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    args: ["--disable-setuid-sandbox", "--window-size=1400,750"],
    defaultViewport: {
      width: 1400,
      height: 750,
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

  try {
    await page.goto(ETHERSCAN_BY_ADDRESS);
    await page.setCookie({
      name: "etherscan_cookieconsent",
      value: "True",
      domain: "etherscan.io",
    });
  } catch (err) {
    console.error(err);
  }

  // If going through all txns, get all transactions from each page
  if (!isFile) {
    // Start at first page
    let currPageNum = 1;
    let totalPageNum = 1;

    // Get total number of pages at the first page
    try {
      totalPageNum = await page.$$eval(
        `[aria-label="page navigation"] li.page-item`,
        (btns) => {
          const pageLabelText = btns[2]?.textContent?.split(" ") || "";
          const pageNumber = Number(pageLabelText[pageLabelText?.length - 1]);
          currPageNum = 2;

          return pageNumber;
        }
      );
    } catch {
      console.info("Only one page");
    }

    console.log(`Total pages: ${totalPageNum}`);

    while (currPageNum < totalPageNum + 1) {
      console.log(`On page ${currPageNum}`);

      await page.goto(`${ETHERSCAN_BY_ADDRESS}&p=${currPageNum}`);

      // Wait for the txns page to load and display the txns.
      const txnsList = await page.$$eval(
        ".hash-tag > .myFnExpandBox_searchVal",
        (rows) => rows.map((el) => el.textContent)
      );
      totalTxnList.push(...txnsList);

      // Increment current page number
      currPageNum++;
    }
  }

  const spentAmtTxnsList = [];
  // Collect all transaction items;
  const allTxnData = [];
  const currentYearOnly = new Date().getFullYear();
  let isNotCurrentYear = false;

  for (const txn of totalTxnList) {
    try {
      await page.goto(`${ETHERSCAN_BY_TXN}/${txn}`, {
        waitUntil: "domcontentloaded",
      });
      console.log("Transaction hash: ", txn);

      // Date of txn
      const date = await page.$eval(
        "#ContentPlaceHolder1_divTimeStamp",
        (ele) => {
          const spanTextContent =
            ele.textContent?.match(/(?<=\().*(?=\))/) || [];
          const dateString = spanTextContent[0].split(" ")[0];
          const date = new Date(dateString);

          return {
            year: date.getFullYear(),
            local: date.toLocaleDateString(),
          };
        }
      );

      isNotCurrentYear = date.year !== currentYearOnly;
      if (isNotCurrentYear) {
        console.log(`Exclude ${date.year} Transaction  ...`);
      }
      console.log("Date of txn: ", date);

      // Amount paid to the miner for processing the transaction (in ETH)
      const txnEthFee = await page.$eval(
        "#ContentPlaceHolder1_spanTxFee",
        (ele) => ele.textContent?.split(" ")[0].replace(/[^0-9.]/g, "")
      );

      // Cost per unit of gas specified for the transaction (in ETH)
      const gasEthPrice = await page.$eval(
        "#ContentPlaceHolder1_spanGasPrice",
        (ele) => ele.textContent?.split(" ")[0].replace(/[^0-9.]/g, "")
      );

      // Closing price of Ether on day of txn
      const ethUSD = await page.$eval(
        "#ContentPlaceHolder1_spanClosingPrice",
        (ele) => ele.textContent?.split(" ")[0].replace(/[^0-9.]/g, "")
      );
      console.log("Ether Closing USD: ", ethUSD);

      // Fee values in USD
      const txnUsdFee = Number(txnEthFee) * Number(ethUSD);
      const gasUsdFee = Number(gasEthPrice) * Number(ethUSD);
      // Total fees in USD
      const spentAmt = txnUsdFee + gasUsdFee;

      console.log("Transaction Fee (USD): ", txnUsdFee);
      console.log("Gas Fee (USD): ", gasUsdFee);
      console.log("TOTAL: $", spentAmt);

      const txnHashTrunc = txn?.substring(0, 8);

      // Only collect data for relevant year
      if (!isNotCurrentYear || isFile) {
        const imageFile = `${ARTIFACTS_DIR}/${
          isFile ? OUTPUT_FILE_NAME : ADDRESS_TRUNC
        }-${txnHashTrunc}.png`;

        const txnItem = {
          date: date.local,
          "spent amt": Number(spentAmt).toPrecision(3),
          description: `Fee reimbursement for txn: ${txnHashTrunc}`,
          "txn hash": txn,
          "txn fee (eth)": Number(txnEthFee),
          "gas fee (eth)": Number(gasEthPrice),
          imageFile,
        };

        console.table(txnItem);
        spentAmtTxnsList.push(spentAmt);
        allTxnData.push(txnItem);
        await page.screenshot({
          path: imageFile,
          fullPage: true,
        });
      }

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

  fs.writeFile(
    `${OUTPUT_DIR}/${fileName}-reimbursements.csv`,
    allRows,
    "utf8",
    (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log(
          `File created: ${fileName}-reimbursements.csv saved to '${OUTPUT_DIR}' directory`
        );
      }
    }
  );
}
