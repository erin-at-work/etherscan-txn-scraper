import puppeteer from "puppeteer";
import {
  ADDRESS_TRUNC,
  ARTIFACTS_DIR,
  ETHERSCAN_BY_ADDRESS,
  ETHERSCAN_BY_TXN,
  OUTPUT_FILE_NAME,
} from "./src/constants";
import {
  createCsvFile,
  createFailedTxnsFile,
  getAllAddressTxns,
  getFileTxns,
} from "./src/utils";

// Collect all transaction hashes
const totalTxnList: string[] = [];

// Collect failed transaction hashes
const failedTxnList: string[] = [];

export const txnSource = process.argv[2];
export const isInputFileSource = txnSource === "file" ? true : false;

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    args: ["--disable-setuid-sandbox", "--window-size=1400,750"],
    defaultViewport: {
      width: 1400,
      height: 750,
    },
    devtools: true,
  });
  const page = await browser.newPage();
  // page.on("console", (msg) =>
  //   console.log(`PAGE ${msg.type().toUpperCase()}:`, msg.text())
  // );
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

  // Collect transaction hashes by input source
  isInputFileSource
    ? getFileTxns(totalTxnList)
    : await getAllAddressTxns(totalTxnList, page);

  const spentAmtTxnsList = [];
  // Collect all transaction items;
  const allTxnData = [];
  const currentYearOnly = new Date().getFullYear();
  let isNotCurrentYear = false;

  for (const txn of totalTxnList) {
    try {
      // Wait for 1 second between takes otherwise etherscan complains
      await page.waitForTimeout(1000);
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
          const dateString = spanTextContent[0]?.split(" ")[0];
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
        "#ContentPlaceHolder1_spanGasPrice > .text-muted",
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
      const gasUsdFee = (Number(gasEthPrice) / 1000000000) * Number(ethUSD);
      // Total fees in USD
      const spentAmt = txnUsdFee + gasUsdFee;

      console.log("Transaction Fee (USD): ", txnUsdFee);
      console.log("Gas Fee (USD): ", gasUsdFee);
      console.log("TOTAL: $", spentAmt);

      const txnHashTrunc = txn?.substring(0, 8);

      // Only collect data for relevant year
      if (!isNotCurrentYear || isInputFileSource) {
        const imageFile = `${ARTIFACTS_DIR}/${
          isInputFileSource ? OUTPUT_FILE_NAME : ADDRESS_TRUNC
        }-${txnHashTrunc}.png`;

        const txnItem = {
          date: date.local,
          "spent amt": Number(spentAmt).toPrecision(3),
          description: `Fee reimbursement for txn: ${txnHashTrunc}`,
          "txn hash": txn,
          "txn fee (eth)": Number(txnEthFee),
          "gas fee (eth)": Number(gasEthPrice),
          "image file": imageFile,
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
      failedTxnList.push(txn);
      console.error(err);
    }
  }

  const totalSpentAmt = spentAmtTxnsList.reduce((prev, curr) => prev + curr, 0);
  console.log("Total Spent Amt: ", totalSpentAmt);
  console.log("=======================================");

  if (failedTxnList.length > 0) {
    console.log("Failed transactions:");
    console.table(failedTxnList);
    createFailedTxnsFile(failedTxnList);
  }

  createCsvFile(allTxnData);

  await browser.close();
})();
